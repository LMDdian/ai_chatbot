import { createI18n } from 'vue-i18n'

const messages = {
  zh: {
    app: {
      title: '聊天机器人',
      subtitle: 'Spark WebSocket：wss://spark-api.xf-yun.com/v1.1/chat',
    },
    topbar: {
      settings: '设置',
    },
    chat: {
      inputPlaceholder: '输入消息，Enter 发送，Shift+Enter 换行',
      sending: '发送中…',
      send: '发送',
      thinking: '正在思考…',
      initialAssistant:
        '你好，我是聊天机器人。点击右上角“设置”填写 APPID / APISecret / APIKey 后即可连接星火接口。',
      me: '我',
      robot: '机器人',
    },
    settings: {
      title: '连接设置',
      appId: 'APPID',
      appIdPlaceholder: '填写 APPID',
      apiSecret: 'APISecret',
      apiSecretPlaceholder: '填写 APISecret',
      apiKey: 'APIKey',
      apiKeyPlaceholder: '填写 APIKey',
      nickname: '称呼',
      nicknamePlaceholder: '李太白',
      systemPromptLabel: '系统角色设定（system 提示词）',
      systemPromptPlaceholder:
        '例如：你现在扮演李白，你豪情万丈，狂放不羁；接下来请用李白的口吻和用户对话。留空则不发送 system 角色。',
      cancel: '取消',
      save: '保存',
      close: '关闭',
    },
    hint: {
      title: '预留接口说明',
      text: '页面发送时会调用 `SparkWSClient.sendText()`，内部按你提供的 JSON 结构组装 `header/parameter/payload` 并通过 WebSocket 发送；响应按流式 delta 逐步拼接到机器人气泡中。',
    },
    error: {
      fillAllKeys: '请完整填写 APPID / APISecret / APIKey',
      needKeysFirst: '请先点击右上角“设置”填写 APPID / APISecret / APIKey',
    },
    lang: {
      zh: '中文',
      en: 'English',
    },
  },
  en: {
    app: {
      title: 'AI Chatbot',
      subtitle: 'Spark WebSocket: wss://spark-api.xf-yun.com/v1.1/chat',
    },
    topbar: {
      settings: 'Settings',
    },
    chat: {
      inputPlaceholder: 'Type a message. Enter: send, Shift+Enter: new line',
      sending: 'Sending…',
      send: 'Send',
      thinking: 'Thinking…',
      initialAssistant:
        "Hi, I'm your chatbot. Click “Settings” in the top-right corner, fill in APPID / APISecret / APIKey to connect to Spark service.",
      me: 'Me',
      robot: 'Robot',
    },
    settings: {
      title: 'Connection Settings',
      appId: 'APPID',
      appIdPlaceholder: 'Enter APPID',
      apiSecret: 'APISecret',
      apiSecretPlaceholder: 'Enter APISecret',
      apiKey: 'APIKey',
      apiKeyPlaceholder: 'Enter APIKey',
      nickname: 'Nickname',
      nicknamePlaceholder: 'e.g. Li Taibai',
      systemPromptLabel: 'System role (system prompt)',
      systemPromptPlaceholder:
        'For example: You are Li Bai, bold and unrestrained. Please speak in Li Bai’s tone when talking to the user. Leave empty to skip system role.',
      cancel: 'Cancel',
      save: 'Save',
      close: 'Close',
    },
    hint: {
      title: 'Reserved API note',
      text: 'On send, the page calls `SparkWSClient.sendText()`; internally it builds `header/parameter/payload` JSON as required and sends via WebSocket. Streaming deltas are appended to the assistant bubble.',
    },
    error: {
      fillAllKeys: 'Please fill APPID / APISecret / APIKey',
      needKeysFirst:
        'Please click “Settings” in the top-right and fill APPID / APISecret / APIKey first.',
    },
    lang: {
      zh: '中文',
      en: 'English',
    },
  },
}

export const i18n = createI18n({
  legacy: false,
  locale: 'zh',
  fallbackLocale: 'en',
  messages,
})
