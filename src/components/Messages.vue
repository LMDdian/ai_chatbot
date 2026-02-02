<!-- Messages.vue -->
<script setup>
import { computed, watch, nextTick } from 'vue'

// 定义 props
const props = defineProps({
  messages: {
    type: Array,
    required: true,
  },
  messageDisplays: {
    type: Object,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
})

// 定义 emit
const emit = defineEmits(['update:locale'])

// 定义双向绑定的 locale
const locale = defineModel('locale', { required: true })

// 确保消息数组的响应性
const reactiveMessages = computed(() => props.messages)

// 监听消息变化，确保DOM及时更新
watch(
  () => props.messages,
  async () => {
    await nextTick()
  },
  { deep: true, flush: 'post' },
)
</script>

<template>
  <div class="chat-inner">
    <div v-for="m in reactiveMessages" :key="m.id" class="row" :class="m.role">
      <div class="bubble">
        <div class="meta">
          {{ messageDisplays[m.id] }}
        </div>
        <div class="content" :class="{ empty: !m.content }">
          <template v-if="m.content">{{ m.content }}</template>
          <template v-else>{{ t('chat.thinking') }}</template>
        </div>
        <!-- 可选：显示语言标签 -->
        <div v-if="m.role === 'assistant' && m.lang && m.lang !== locale" class="lang-badge">
          {{ m.lang === 'zh' || m.lang === 'zh-CN' ? '中' : 'EN' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-inner {
  margin: 0 auto;
}

.row {
  display: flex;
  margin: 10px 0;
}
.row.user {
  justify-content: flex-end;
}
.row.assistant {
  justify-content: flex-start;
}
.row.system {
  justify-content: center;
}
.row.system .bubble {
  max-width: 600px;
}

.bubble {
  width: min(760px, 92%);
  border-radius: 16px;
  padding: 10px 12px;
  border: 1px solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 8px 30px rgba(15, 23, 42, 0.06);
}
.row.user .bubble {
  background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
  color: #fff;
  border-color: rgba(37, 99, 235, 0.25);
}
.row.assistant .bubble {
  background: rgba(255, 255, 255, 0.85);
}

.meta {
  font-size: 12px;
  opacity: 0.85;
  margin-bottom: 6px;
}
.row.user .meta {
  opacity: 0.9;
}
.row.system .meta {
  font-weight: 600;
}

.content {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
}
.content.empty {
  opacity: 0.7;
}

.lang-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 2px 6px;
  background: rgba(15, 23, 42, 0.08);
  border-radius: 4px;
  font-size: 10px;
  color: rgba(15, 23, 42, 0.6);
  user-select: none;
}
</style>
