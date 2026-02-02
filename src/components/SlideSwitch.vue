<script setup lang="ts">
defineProps<{
	toggleLanguage: () => void;
}>()
const locale = defineModel<string>('locale', { required: true })
</script>

<template>
	<div
		class="slide-switch"
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
</template>

<style scoped>
/* 语言切换滑块样式 */
.slide-switch {
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
.slide-switch.en-mode {
  background: linear-gradient(180deg, #d8304c 0%, #de3364 100%);
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
    .toggle-track .toggle-label {
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
.slide-switch.en-mode .toggle-label.zh {
  opacity: 0.6;
}

.toggle-label.en {
  opacity: 0.6;
}
.slide-switch.en-mode .toggle-label.en {
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

.slide-switch.en-mode .toggle-thumb {
  transform: translateX(32px);
}

/* 悬停效果 */
.slide-switch:hover {
  transform: scale(1.05);
}

.slide-switch:active {
  transform: scale(0.95);
}
</style>