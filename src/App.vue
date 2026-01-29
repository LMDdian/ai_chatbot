<!-- App.vue -->
<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { SparkWSClient } from './services/sparkWs'
import Messages from './component/Messages.vue'

const STORAGE_KEY = 'spark_settings_v1'

const settings = reactive({
  appId: '',
  apiSecret: '',
  apiKey: '',
  systemPrompt: '你现在扮演李白，你豪情万丈，狂放不羁；接下来请用李白的口吻和用户对话。',
})

const ui = reactive({
  settingsOpen: false,
  sending: false,
  error: '',
})

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

const { t, locale } = useI18n()
const aiName = ref(
  roleConfig.value[locale.value === 'zh' || locale.value === 'zh-CN' ? 'zh' : 'en'].name,
)

const inputText = ref('')
const messages = ref([
  {
    id: crypto?.randomUUID?.() || String(Date.now()),
    role: 'system',
    content: t('chat.initialAssistant'),
    ts: Date.now(),
    aiName: t('chat.robot'),
    lang: locale.value,
  },
])

const messageDisplays = computed(() => {
  const displays = {}
  messages.value.forEach((msg) => {
    displays[msg.id] = msg.role === 'user' ? t('chat.me') : String(msg.aiName || t('chat.robot'))
  })
  return displays
})

const listEl = ref(null)
const clientRef = ref(null)

const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !ui.sending
})

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
    const currentLang = locale.value === 'zh' || locale.value === 'zh-CN' ? 'zh' : 'en'
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

function applyRoleConfig() {
  const currentLang = locale.value === 'zh' || locale.value === 'zh-CN' ? 'zh' : 'en'
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

function saveSettings() {
  ui.error = ''
  if (!settings.appId.trim() || !settings.apiSecret.trim() || !settings.apiKey.trim()) {
    ui.error = t('error.fillAllKeys')
    return
  }

  // 检查是否修改了系统提示词或AI名称
  const oldSettings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  const systemPromptChanged = oldSettings.systemPrompt !== settings.systemPrompt.trim()
  const aiNameChanged = oldSettings.aiName !== aiName.value

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
    // 添加一条系统消息说明角色已更新
    const message = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      role: 'system',
      content:
        locale.value === 'zh' || locale.value === 'zh-CN'
          ? `AI角色已更新为${aiName.value}，历史对话已清空`
          : `AI role updated to ${aiName.value}, chat history cleared`,
      ts: Date.now(),
      isSystem: true,
      aiName: null,
      lang: locale.value,
    }
    messages.value.push(message)
    scrollToBottom()
  }

  try {
    clientRef.value?.close?.()
  } catch {
    // ignore
  }
  clientRef.value = null
}

function openSettings() {
  ui.error = ''
  ui.settingsOpen = true
}

function closeSettings() {
  ui.error = ''
  ui.settingsOpen = false
}

function resetToDefaultRole() {
  const currentLang = locale.value === 'zh' || locale.value === 'zh-CN' ? 'zh' : 'en'
  const config = roleConfig.value[currentLang]

  settings.systemPrompt = config.defaultPrompt
  aiName.value = config.name
}

function toggleLanguage() {
  locale.value = locale.value === 'zh' || locale.value === 'zh-CN' ? 'en' : 'zh'
}

async function scrollToBottom() {
  await nextTick()
  await nextTick() // 双重nextTick确保DOM完全更新
  const el = listEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
}

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

function buildTextHistoryForServer({ maxTurns = 10 } = {}) {
  const core = messages.value
    .filter(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') && m.content && m.content.trim().length > 0,
    )
    .map((m) => ({ role: m.role, content: m.content }))

  const maxItems = Math.max(2, maxTurns * 2)
  const sliced = core.slice(-maxItems)

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

async function send() {
  ui.error = ''
  const text = inputText.value.trim()
  if (!text || ui.sending) return

  if (!settings.appId.trim() || !settings.apiSecret.trim() || !settings.apiKey.trim()) {
    ui.error = t('error.needKeysFirst')
    ui.settingsOpen = true
    return
  }

  inputText.value = ''
  ui.sending = true

  const userMsg = {
    id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
    role: 'user',
    content: text,
    ts: Date.now(),
    aiName: null,
    lang: locale.value,
  }
  messages.value.push(userMsg)

  const assistantMsg = {
    id: crypto?.randomUUID?.() || String(Date.now() + Math.random()),
    role: 'assistant',
    content: '',
    ts: Date.now(),
    aiName: aiName.value,
    lang: locale.value,
  }
  messages.value.push(assistantMsg)
  await scrollToBottom()

  try {
    const client = ensureClient()
    const history = buildTextHistoryForServer({ maxTurns: 10 })

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
    const msg = e instanceof Error ? e.message : '请求失败'
    ui.error = msg
    assistantMsg.content = assistantMsg.content || `（出错）${msg}`
  } finally {
    ui.sending = false
    await scrollToBottom()
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

function clearChatHistory(showMessage = false) {
  // 清空所有消息，只保留初始的助手消息
  const currentLang = locale.value === 'zh' || locale.value === 'zh-CN' ? 'zh' : 'en'
  const config = roleConfig.value[currentLang] || roleConfig.value.en

  messages.value = [
    {
      id: crypto?.randomUUID?.() || String(Date.now()),
      role: 'system',
      content: t('chat.initialAssistant'),
      ts: Date.now(),
      aiName: t('chat.robot'),
      lang: locale.value,
    },
  ]

  // 如果是手动清空，显示提示消息
  if (showMessage) {
    const message = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      role: 'system',
      content:
        locale.value === 'zh' || locale.value === 'zh-CN'
          ? '对话历史已清空'
          : 'Chat history cleared',
      ts: Date.now(),
      isSystem: true,
      aiName: null,
      lang: locale.value,
    }
    messages.value.push(message)
    scrollToBottom()
  }
}

onMounted(() => {
  loadSettings()
  scrollToBottom()
})

watch(
  locale,
  (newLang, oldLang) => {
    console.log('语言切换:', oldLang, '→', newLang)

    const getLangKey = (lang) => {
      if (!lang) return 'en'
      return lang === 'zh' || lang === 'zh-CN' ? 'zh' : 'en'
    }

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

function addLanguageSwitchMessage(lang) {
  const langKey = lang === 'zh' || lang === 'zh-CN' ? 'zh' : 'en'
  const config = roleConfig.value[langKey] || roleConfig.value.en

  const message = {
    id: crypto?.randomUUID?.() || String(Date.now()),
    role: 'system',
    content:
      langKey === 'zh'
        ? `语言已切换到中文，AI角色已切换为${config.name}`
        : `Language switched to English, AI role changed to ${config.name}`,
    ts: Date.now(),
    isSystem: true,
    aiName: null,
    lang: langKey,
  }
  messages.value.push(message)
  scrollToBottom()
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="title">{{ t('app.title') }}</div>
        <div class="subtitle">{{ t('app.subtitle') }}</div>
      </div>
      <div class="topbar-actions">
        <div class="lang-toggle">
          <div
            class="toggle-switch"
            :class="{ 'en-mode': locale === 'en' }"
            @click="toggleLanguage"
            role="switch"
            :aria-checked="locale === 'en'"
            :title="locale === 'zh' ? '切换到英文' : 'Switch to Chinese'"
          >
            <div class="toggle-track">
              <span class="toggle-label zh">中</span>
              <span class="toggle-label en">EN</span>
            </div>
            <div class="toggle-thumb"></div>
          </div>
        </div>
        <button
          class="btn btn-ghost"
          type="button"
          @click="clearChatHistory(true)"
          :title="locale === 'zh' ? '清空对话历史' : 'Clear chat history'"
        >
          {{ locale === 'zh' ? '清空' : 'Clear' }}
        </button>
        <button class="btn btn-ghost" type="button" @click="openSettings">
          {{ t('topbar.settings') }}
        </button>
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
      <button class="btn btn-primary" type="button" :disabled="!canSend" @click="send">
        {{ ui.sending ? t('chat.sending') : t('chat.send') }}
      </button>
    </footer>

    <!-- 设置弹窗 -->
    <teleport to="body">
      <div v-if="ui.settingsOpen" class="modal-backdrop" @click.self="closeSettings">
        <div class="modal" role="dialog" aria-modal="true" aria-label="设置">
          <div class="modal-header">
            <div class="modal-title">{{ t('settings.title') }}</div>
            <button class="btn btn-ghost" type="button" @click="closeSettings">
              {{ t('settings.close') }}
            </button>
          </div>
          <div class="modal-body">
            <label class="field">
              <div class="label">{{ t('settings.appId') }}</div>
              <input
                v-model="settings.appId"
                class="text"
                :placeholder="t('settings.appIdPlaceholder')"
              />
            </label>
            <label class="field">
              <div class="label">{{ t('settings.apiSecret') }}</div>
              <input
                v-model="settings.apiSecret"
                class="text"
                :placeholder="t('settings.apiSecretPlaceholder')"
              />
            </label>
            <label class="field">
              <div class="label">{{ t('settings.apiKey') }}</div>
              <input
                v-model="settings.apiKey"
                class="text"
                :placeholder="t('settings.apiKeyPlaceholder')"
              />
            </label>

            <label class="field">
              <div class="label">{{ t('settings.nickname') }}</div>
              <input
                v-model="aiName"
                class="text"
                :placeholder="t('settings.nicknamePlaceholder')"
              />
            </label>

            <label class="field">
              <div class="label">{{ t('settings.systemPromptLabel') }}</div>
              <textarea
                v-model="settings.systemPrompt"
                class="text area"
                rows="3"
                :placeholder="t('settings.systemPromptPlaceholder')"
              />
              <button
                class="btn btn-ghost reset-btn"
                type="button"
                @click="resetToDefaultRole"
                :title="locale === 'zh' ? '重置为默认角色设定' : 'Reset to default role'"
              >
                {{ locale === 'zh' ? '重置为默认角色' : 'Reset to Default Role' }}
              </button>
            </label>
          </div>
          <div class="modal-footer">
            <button class="btn" type="button" @click="closeSettings">
              {{ t('settings.cancel') }}
            </button>
            <button class="btn btn-primary" type="button" @click="saveSettings">
              {{ t('settings.save') }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
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
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}

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

.lang-toggle {
  display: flex;
  gap: 4px;
}

.btn.small {
  height: 32px;
  padding-inline: 10px;
  font-size: 12px;
}

.lang-toggle .btn.active {
  border-color: rgba(37, 99, 235, 0.6);
  background: rgba(37, 99, 235, 0.08);
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
  padding: 14px 16px;
}

.composer {
  display: flex;
  gap: 10px;
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
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  outline: none;
  background: rgba(255, 255, 255, 0.9);
}
.input:focus {
  border-color: rgba(37, 99, 235, 0.65);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}

.btn {
  height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  user-select: none;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-ghost {
  background: transparent;
}
.btn-primary {
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
  border-color: rgba(37, 99, 235, 0.25);
  color: #fff;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.45);
  display: grid;
  place-items: center;
  padding: 18px;
}
.modal {
  width: min(560px, 100%);
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 18px;
  box-shadow: 0 30px 90px rgba(2, 6, 23, 0.25);
  overflow: hidden;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
}
.modal-title {
  font-weight: 700;
}
.modal-body {
  padding: 14px;
  width: 100%;
  display: grid;
  gap: 12px;
}
.field {
  width: 100%;
}
.field .label {
  width: 90%;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
  margin-bottom: 6px;
}
.text {
  width: 90%;
  min-height: 42px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  outline: none;
  background: rgba(255, 255, 255, 0.9);
}
.text:focus {
  border-color: rgba(37, 99, 235, 0.65);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}
.area {
  resize: vertical;
}
.hint {
  width: 90%;
  margin-top: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(37, 99, 235, 0.06);
  border: 1px solid rgba(37, 99, 235, 0.14);
}
.hint-title {
  font-size: 12px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.75);
  margin-bottom: 4px;
}
.hint-text {
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
  line-height: 1.5;
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}

.reset-btn {
  margin-top: 8px;
  height: 32px;
  font-size: 12px;
  padding: 0 10px;
  border-color: rgba(239, 68, 68, 0.25);
  color: #dc2626;
}

.reset-btn:hover {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.4);
}

/* 语言切换滑块样式 */
.lang-toggle {
  display: flex;
  align-items: center;
}

.toggle-switch {
  position: relative;
  width: 64px;
  height: 32px;
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
  border-radius: 50px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.2);
  overflow: hidden;
}

.toggle-switch.en-mode {
  background: linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%);
}

.toggle-track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
}

.toggle-label {
  font-size: 12px;
  font-weight: 600;
  color: white;
  transition: opacity 0.3s ease;
  user-select: none;
  z-index: 1;
}

.toggle-label.zh {
  opacity: 1;
}

.toggle-switch.en-mode .toggle-label.zh {
  opacity: 0.6;
}

.toggle-label.en {
  opacity: 0.6;
}

.toggle-switch.en-mode .toggle-label.en {
  opacity: 1;
}

.toggle-thumb {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 24px;
  height: 24px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease;
  z-index: 2;
}

.toggle-switch.en-mode .toggle-thumb {
  transform: translateX(32px);
}

/* 悬停效果 */
.toggle-switch:hover {
  transform: scale(1.05);
}

.toggle-switch:active {
  transform: scale(0.95);
}
</style>
