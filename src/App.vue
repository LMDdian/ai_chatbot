<!-- App.vue -->
<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SparkWSClient } from './services/sparkWs'
import Messages from './components/Messages.vue'
import SlideSwitch from './components/SlideSwitch.vue'
import Button from './components/Button.vue'
import SettingsModal from './components/SettingModal.vue'

// ==================== 常量定义 ====================
const STORAGE_KEY = 'spark_settings_v1'

// ==================== 工具函数 ====================
/**
 * 获取语言键值（zh 或 en）
 */
function getLangKey(lang) {
  if (!lang) return 'en'
  return lang === 'zh' || lang === 'zh-CN' ? 'zh' : 'en'
}

/**
 * 生成唯一ID
 */
function generateId() {
  return crypto?.randomUUID?.() || String(Date.now() + Math.random())  // 兼容设置
}

/**
 * 创建系统消息
 */
function createSystemMessage(content, options = {}) {
  return {
    id: generateId(),
    role: 'system',
    content,
    ts: Date.now(),
    isSystem: true,
    aiName: t('chat.robot'),
    lang: locale.value,
    ...options,
  }
}

/**
 * 创建初始系统消息
 */
function createInitialSystemMessage() {
  return {
    id: generateId(),
    role: 'system',
    content: t('chat.initialAssistant'),
    ts: Date.now(),
    aiName: t('chat.robot'),
    lang: locale.value,
  }
}

// ==================== 响应式状态 ====================
// API配置和系统提示词
const settings = reactive({
  appId: '',
  apiSecret: '',
  apiKey: '',
  apiName: '李白',
  systemPrompt: '你现在扮演李白，你豪情万丈，狂放不羁；接下来请用李白的口吻和用户对话。',
})

// UI状态
const ui = reactive({
  settingsOpen: false,    // 设置弹窗是否打开
  sending: false,         // 是否正在发送消息
  error: '',              // 错误信息
})

// 角色配置（中英文）
const roleConfig = ref({
  zh: {
    name: '李太白',
    defaultPrompt: '你现在扮演李白，你豪情万丈，狂放不羁；接下来请用李白的口吻和用户对话。',
  },
  en: {
    name: 'Shakespeare',
    defaultPrompt:
      'You are now playing the role of Shakespeare, you are witty, eloquent, and poetic. Please respond to the user in the style of Shakespeare.',
  },
})

// 国际化
const { t, locale } = useI18n()

// AI名称（根据当前语言初始化）
const aiName = ref(roleConfig.value[getLangKey(locale.value)].name)

// 输入框文本
const inputText = ref('')

// 消息列表
const messages = ref([createInitialSystemMessage()])

// DOM引用
const listEl = ref(null)
const clientRef = ref(null)

// ==================== 计算属性 ====================
/**
 * 消息显示名称映射
 */
const messageDisplays = computed(() => {
  const displays = {}
  messages.value.forEach((msg) => {
    displays[msg.id] = msg.role === 'user' ? t('chat.me') : String(msg.aiName || t('chat.robot'))
  })
  return displays
})

/**
 * 是否可以发送消息
 */
const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !ui.sending
})

// ==================== 设置管理 ====================
/**
 * 加载设置（从localStorage）
 */
function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      applyRoleConfig()
      return
    }

    const parsed = JSON.parse(raw)
    settings.appId = parsed?.appId || ''
    settings.apiSecret = parsed?.apiSecret || ''
    settings.apiKey = parsed?.apiKey || ''

    const currentLang = getLangKey(locale.value)
    if (parsed?.systemPrompt) {
      settings.systemPrompt = parsed.systemPrompt
    } else {
      settings.systemPrompt = roleConfig.value[currentLang].defaultPrompt
    }

    aiName.value = parsed?.aiName || roleConfig.value[currentLang].name
  } catch {
    applyRoleConfig()
  }
}

/**
 * 应用角色配置（根据当前语言）
 */
function applyRoleConfig() {
  const currentLang = getLangKey(locale.value)
  const config = roleConfig.value[currentLang]

  // 如果系统提示词为空或者是默认的，则应用新的角色配置
  if (
    !settings.systemPrompt.trim() ||
    settings.systemPrompt === roleConfig.value.zh.defaultPrompt ||
    settings.systemPrompt === roleConfig.value.en.defaultPrompt
  ) {
    settings.systemPrompt = config.defaultPrompt
  }

  // 如果AI名称是默认的角色名，则更新为当前语言的角色名
  if (aiName.value === '李太白' || aiName.value === 'Shakespeare' || !aiName.value.trim()) {
    aiName.value = config.name
  }
}

/**
 * 保存设置（到localStorage）
 */
function saveSettings() {
  ui.error = ''

  // 验证必填字段
  if (!settings.appId.trim() || !settings.apiSecret.trim() || !settings.apiKey.trim()) {
    ui.error = t('error.fillAllKeys')
    return
  }

  // 检查是否修改了系统提示词或AI名称
  const oldSettings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  const systemPromptChanged = oldSettings.systemPrompt !== settings.systemPrompt.trim()
  const aiNameChanged = oldSettings.aiName !== aiName.value

  // 保存到localStorage
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      appId: settings.appId.trim(),
      apiSecret: settings.apiSecret.trim(),
      apiKey: settings.apiKey.trim(),
      systemPrompt: settings.systemPrompt.trim(),
      aiName: aiName.value,
      locale: locale.value,
    }),
  )

  ui.settingsOpen = false

  // 如果修改了系统提示词或AI名称，清空历史对话
  if (systemPromptChanged || aiNameChanged) {
    clearChatHistory()
    const message = createSystemMessage(
      getLangKey(locale.value) === 'zh'
        ? `AI角色已更新为${aiName.value}，历史对话已清空`
        : `AI role updated to ${aiName.value}, chat history cleared`,
    )
    messages.value.push(message)
    scrollToBottom()
  }

  // 关闭旧的WebSocket连接
  try {
    clientRef.value?.close?.()
  } catch {
    // ignore
  }
  clientRef.value = null
}

/**
 * 重置为默认角色
 */
function resetToDefaultRole() {
  const currentLang = getLangKey(locale.value)
  const config = roleConfig.value[currentLang]

  settings.systemPrompt = config.defaultPrompt
  aiName.value = config.name
}

// ==================== UI控制 ====================
/**
 * 打开设置弹窗
 */
function openSettings() {
  ui.error = ''
  ui.settingsOpen = true
}

/**
 * 关闭设置弹窗
 */
function closeSettings() {
  ui.error = ''
  ui.settingsOpen = false
}

/**
 * 切换语言
 */
function toggleLanguage() {
  locale.value = getLangKey(locale.value) === 'zh' ? 'en' : 'zh'
}

/**
 * 滚动到底部
 */
async function scrollToBottom() {
  await nextTick()
  await nextTick() // 双重nextTick确保DOM完全更新
  const el = listEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

// ==================== WebSocket客户端管理 ====================
/**
 * 确保WebSocket客户端已创建
 */
function ensureClient() {
  if (clientRef.value) return clientRef.value

  clientRef.value = new SparkWSClient({
    appId: settings.appId.trim(),
    apiKey: settings.apiKey.trim(),
    apiSecret: settings.apiSecret.trim(),
    uid: settings.appId.trim(),
  })

  return clientRef.value
}

// ==================== 消息处理 ====================
/**
 * 构建发送给服务器的消息历史
 */
function buildTextHistoryForServer({ maxTurns = 10 } = {}) {
  // 过滤出有效的用户和助手消息
  const core = messages.value
    .filter(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') && m.content && m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content }))

  // 取最近的消息（最多maxTurns轮对话）
  const maxItems = Math.max(2, maxTurns * 2)
  const sliced = core.slice(-maxItems)

  // 添加系统提示词
  const prompt = settings.systemPrompt?.trim()
  if (!prompt) {
    return sliced
  }

  const system = {
    role: 'system',
    content: prompt,
  }

  return [system, ...sliced]
}

/**
 * 发送消息
 */
async function send() {
  ui.error = ''
  const text = inputText.value.trim()

  // 验证输入和状态
  if (!text || ui.sending) return

  // 验证API配置
  if (!settings.appId.trim() || !settings.apiSecret.trim() || !settings.apiKey.trim()) {
    ui.error = t('error.needKeysFirst')
    ui.settingsOpen = true
    return
  }

  // 清空输入框并设置发送状态
  inputText.value = ''
  ui.sending = true

  // 创建用户消息
  const userMsg = {
    id: generateId(),
    role: 'user',
    content: text,
    ts: Date.now(),
    aiName: null,
    lang: locale.value,
  }
  messages.value.push(userMsg)

  // 创建助手消息占位符
  const assistantMsg = {
    id: generateId(),
    role: 'assistant',
    content: '',
    ts: Date.now(),
    aiName: aiName.value,
    lang: locale.value,
  }
  messages.value.push(assistantMsg)
  await scrollToBottom()

  try {
    // 获取客户端并构建历史
    const client = ensureClient()
    const history = buildTextHistoryForServer({ maxTurns: 10 })

    // 发送消息并流式接收响应
    await client.sendText({
      text: history,
      domain: 'lite',
      temperature: 0.5,
      maxTokens: 1024,
      onDelta: (delta) => {
        assistantMsg.content += delta
        // 强制触发响应性更新
        messages.value = [...messages.value]
        scrollToBottom()
      },
    })
  } catch (e) {
    // 错误处理
    const msg = e instanceof Error ? e.message : '请求失败'
    ui.error = msg
    assistantMsg.content = assistantMsg.content || `（出错）${msg}`
  } finally {
    ui.sending = false
    await scrollToBottom()
  }
}

/**
 * 键盘事件处理（Enter发送，Shift+Enter换行）
 */
function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

/**
 * 清空对话历史
 */
function clearChatHistory(showMessage = false) {
  // 重置消息列表，只保留初始系统消息
  messages.value = [createInitialSystemMessage()]

  // 如果是手动清空，显示提示消息
  if (showMessage) {
    const message = createSystemMessage(
      getLangKey(locale.value) === 'zh' ? '对话历史已清空' : 'Chat history cleared',
    )
    messages.value.push(message)
    scrollToBottom()
  }
}

// ==================== 语言切换 ====================
/**
 * 添加语言切换提示消息
 */
function addLanguageSwitchMessage(lang) {
  const langKey = getLangKey(lang)
  const config = roleConfig.value[langKey] || roleConfig.value.en

  const message = createSystemMessage(
    langKey === 'zh'
      ? `语言已切换到中文，AI角色已切换为${config.name}`
      : `Language switched to English, AI role changed to ${config.name}`,
    { lang: langKey },
  )
  messages.value.push(message)
  scrollToBottom()
}

// ==================== 生命周期和监听器 ====================
/**
 * 组件挂载时初始化
 */
onMounted(() => {
  loadSettings()
  scrollToBottom()
})

/**
 * 监听语言切换
 */
watch(
  locale,
  (newLang, oldLang) => {
    console.log('语言切换:', oldLang, '→', newLang)

    const newLangKey = getLangKey(newLang)
    const newConfig = roleConfig.value[newLangKey] || roleConfig.value.en

    if (oldLang) {
      const oldLangKey = getLangKey(oldLang)
      const oldConfig = roleConfig.value[oldLangKey] || roleConfig.value.en

      // 更智能的系统提示词更新逻辑
      // 如果当前提示词是默认的，或者包含了旧角色的名字，则更新为新的默认提示词
      const shouldUpdatePrompt =
        settings.systemPrompt === oldConfig.defaultPrompt ||
        settings.systemPrompt.includes(oldConfig.name) ||
        settings.systemPrompt.trim() === '' ||
        // 如果提示词很短且可能是默认的变体
        settings.systemPrompt.length < 50

      if (shouldUpdatePrompt) {
        settings.systemPrompt = newConfig.defaultPrompt
      }

      // 切换角色时清空历史对话
      clearChatHistory()
    }

    aiName.value = newConfig.name
    addLanguageSwitchMessage(newLangKey)
  },
  { immediate: true },
)
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="title">{{ t('app.title') }}</div>
        <div class="subtitle">{{ t('app.subtitle') }}</div>
      </div>
      <div class="topbar-actions">
        <SlideSwitch :toggleLanguage="toggleLanguage" v-model:locale="locale" />
        <Button
          variant="ghost"
          @click="clearChatHistory(true)"
          :title="locale === 'zh' ? '清空对话历史' : 'Clear chat history'"
        >
          {{ locale === 'zh' ? '清空' : 'Clear' }}
        </Button>
        <Button variant="ghost" @click="openSettings">
          {{ t('topbar.settings') }}
        </Button>
      </div>
    </header>

    <div v-if="ui.error" class="alert" role="alert">
      {{ ui.error }}
    </div>

    <main ref="listEl" class="chat">
      <Messages
        :messages="messages"
        :messageDisplays="messageDisplays"
        :t="t"
        v-model:locale="locale"
      />
    </main>

    <footer class="composer">
      <textarea
        v-model="inputText"
        class="input"
        rows="1"
        :placeholder="t('chat.inputPlaceholder')"
        @keydown="onKeydown"
      />
    </footer>

    <!-- 设置弹窗 -->
    <SettingsModal
      v-model="ui.settingsOpen"
      :settings="settings"
      v-model:aiName="aiName"
      :locale="locale"
      :t="t"
      @save="saveSettings"
      @close="closeSettings"
      @reset="resetToDefaultRole"
    />
  </div>
</template>

<style scoped>
.page {
  height: 100vh;

  display: flex;
  flex-direction: column;

  background:
    radial-gradient(1200px 600px at 20% 10%, #e9f2ff 0%, transparent 60%),
    radial-gradient(900px 500px at 80% 0%, #ffeef1 0%, transparent 55%),
    linear-gradient(180deg, #fbfcff 0%, #f6f7fb 100%);
  color: #0f172a;
}

    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;

      display: flex;
      justify-content: space-between;
      align-items: center;
      
      padding: 14px 16px;

      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
      
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    }

        /* .brand {
        }*/
            .brand .title {
              font-weight: 700;
              letter-spacing: 0.2px;
            }
            .brand .subtitle {
              margin-top: 2px;
              font-size: 12px;
              color: rgba(15, 23, 42, 0.6);
            }

        .topbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

    .alert {
      margin: 10px 16px 0 16px;
      padding: 10px 12px;
      background: rgba(239, 68, 68, 0.08);
      border: 1px solid rgba(239, 68, 68, 0.25);
      border-radius: 12px;
      color: #991b1b;
      font-size: 13px;
    }
    
    .chat {
      flex: 1;
      overflow: auto;
      padding: 14px 0px;
    }

    .composer {
      display: flex;

      padding: 12px 16px 16px 16px;

      border-top: 1px solid rgba(15, 23, 42, 0.08);

      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(10px);
    }
        .input {
          flex: 1;

          resize: none;

          min-height: 44px;
          max-height: 140px;

          padding: 10px 12px;

          border: 1px solid rgba(15, 23, 42, 0.14);
          border-radius: 14px;
          
          outline: none;  /* 去除默认的聚焦边框 配合focus */

          background: rgba(255, 255, 255, 0.9);
        }
        .input:focus {
          border-color: rgba(37, 99, 235, 0.65);
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
        }

</style>
