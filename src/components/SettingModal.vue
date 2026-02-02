<!-- Teleport.vue - 设置弹窗组件 -->
<script setup>
import { computed } from 'vue'
import Button from './Button.vue'

/**
 * 组件属性定义
 */
const props = defineProps({
  // 控制弹窗显示/隐藏
  modelValue: {
    type: Boolean,
    default: false,
  },
  // 设置对象
  settings: {
    type: Object,
    required: true,
  },
  // AI名称
  aiName: {
    type: String,
    required: true,
  },
  // 当前语言
  locale: {
    type: String,
    required: true,
  },
  // 翻译函数
  t: {
    type: Function,
    required: true,
  },
})

/**
 * 组件事件定义
 */
const emit = defineEmits([
  'update:modelValue',
  'update:aiName',
  'save',
  'close',
  'reset',
])

/**
 * 计算属性：本地AI名称副本（用于双向绑定）
 */
const localAiName = computed({
  get: () => props.aiName,
  set: (value) => emit('update:aiName', value),
})

/**
 * 关闭弹窗
 */
function handleClose() {
  emit('update:modelValue', false)
  emit('close')
}

/**
 * 保存设置
 */
function handleSave() {
  emit('save')
}

/**
 * 重置为默认角色
 */
function handleReset() {
  emit('reset')
}
</script>

<template>
  <teleport to="body">
    <div v-if="modelValue" class="modal-backdrop" @click.self="handleClose">
      <div class="modal" role="dialog" aria-modal="true" aria-label="设置">
        <div class="modal-header">
          <div class="modal-title">{{ t('settings.title') }}</div>
          <Button variant="ghost" @click="handleClose">
            {{ t('settings.close') }}
          </Button>
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
              v-model="localAiName"
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
            <Button
              variant="reset"
              @click="handleReset"
              :title="locale === 'zh' ? '重置为默认角色设定' : 'Reset to default role'"
            >
              {{ locale === 'zh' ? '重置为默认角色' : 'Reset to Default Role' }}
            </Button>
          </label>
        </div>
        <div class="modal-footer">
          <Button @click="handleClose">
            {{ t('settings.cancel') }}
          </Button>
          <Button variant="primary" @click="handleSave">
            {{ t('settings.save') }}
          </Button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
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
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px;
  border-top: 1px solid rgba(15, 23, 42, 0.08);
}
</style>
