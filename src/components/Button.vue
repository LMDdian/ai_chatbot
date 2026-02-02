<!-- Button.vue - 通用按钮组件 -->
<script setup>
import { computed } from 'vue'

/**
 * 按钮属性定义
 */
const props = defineProps({
  // 按钮变体：default | ghost | primary | reset
  variant: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'ghost', 'primary', 'reset'].includes(value),
  },
  // 按钮尺寸：default | small
  size: {
    type: String,
    default: 'default',
    validator: (value) => ['default', 'small'].includes(value),
  },
  // 是否禁用
  disabled: {
    type: Boolean,
    default: false,
  },
  // 按钮类型
  type: {
    type: String,
    default: 'button',
  },
  // 提示文本
  title: {
    type: String,
    default: '',
  },
})

/**
 * 按钮类名计算
 */
const buttonClass = computed(() => {
  const classes = ['btn']
  
  // 添加变体类
  if (props.variant === 'ghost') {
    classes.push('btn-ghost')
  } else if (props.variant === 'primary') {
    classes.push('btn-primary')
  } else if (props.variant === 'reset') {
    classes.push('btn-ghost', 'reset-btn')
  }
  
  // 添加尺寸类
  if (props.size === 'small') {
    classes.push('small')
  }
  
  return classes.join(' ')
})
</script>

<template>
  <button
    :class="buttonClass"
    :type="type"
    :disabled="disabled"
    :title="title"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<style scoped>
.btn {
  height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid rgba(15, 23, 42, 0.14);
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  user-select: none;
  font-size: 14px;
  transition: all 0.2s ease;
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

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%);
}

.reset-btn {
  margin-top: 8px;
  height: 32px;
  font-size: 12px;
  padding: 0 10px;
  border-color: rgba(239, 68, 68, 0.25);
  color: #dc2626;
}

.reset-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.4);
}

.btn.small {
  height: 32px;
  padding-inline: 10px;
  font-size: 12px;
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn:active:not(:disabled) {
  transform: translateY(0);
}
</style>
