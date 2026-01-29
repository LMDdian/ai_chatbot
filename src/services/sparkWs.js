// 讯飞星火（Spark）WebSocket 客户端（浏览器端）
// 目标：提供可直接接入的“预留接口层”，并在缺少/错误配置时给出清晰报错。
// 官方服务地址（v1.1）：wss://spark-api.xf-yun.com/v1.1/chat
//
// 说明：
// - Spark WebSocket 一般需要在 URL 上携带 authorization/date/host 等鉴权参数（HMAC-SHA256）。
// - 本文件实现了常见的签名构造方式，便于你后续直接接真实接口。

const SPARK_HOST = 'spark-api.xf-yun.com'
const SPARK_PATH = '/v1.1/chat'
const SPARK_BASE_WSS = `wss://${SPARK_HOST}${SPARK_PATH}`

function assertNonEmpty(value, name) {
  if (!value || !String(value).trim()) {
    throw new Error(`${name} 不能为空`)
  }
}

function toBase64FromBytes(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function toBase64FromArrayBuffer(buf) {
  return toBase64FromBytes(new Uint8Array(buf))
}

async function hmacSha256Base64(secret, text) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前环境不支持 WebCrypto（crypto.subtle），无法在浏览器端完成签名')
  }
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(text))
  return toBase64FromArrayBuffer(signature)
}

/**
 * 构造 Spark WebSocket 鉴权 URL（常见实现）
 * 参考签名源串：
 * host: ${host}\n
 * date: ${date}\n
 * GET ${path} HTTP/1.1
 */
export async function buildSparkWssUrl({ apiKey, apiSecret }) {
  assertNonEmpty(apiKey, 'APIKey')
  assertNonEmpty(apiSecret, 'APISecret')

  const date = new Date().toUTCString()
  const signatureOrigin = `host: ${SPARK_HOST}\ndate: ${date}\nGET ${SPARK_PATH} HTTP/1.1`
  const signature = await hmacSha256Base64(apiSecret, signatureOrigin)
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`

  // authorizationOrigin 仅包含 ASCII，可安全 btoa；为鲁棒起见仍按 bytes->base64 处理
  const authBase64 = toBase64FromBytes(new TextEncoder().encode(authorizationOrigin))

  const url = new URL(SPARK_BASE_WSS)
  url.searchParams.set('authorization', authBase64)
  url.searchParams.set('date', date)
  url.searchParams.set('host', SPARK_HOST)
  return url.toString()
}

/**
 * 参数构造：将消息历史转换为 Spark payload.message.text
 * @param {Array<{role:'system'|'user'|'assistant', content:string}>} text
 */
export function buildSparkRequestBody({ appId, uid, text, domain = 'lite', temperature = 0.5, maxTokens = 1024 }) {
  assertNonEmpty(appId, 'APPID')
  if (!Array.isArray(text) || text.length === 0) {
    throw new Error('text 不能为空（至少需要 1 条 user/system 消息）')
  }

  return {
    header: {
      app_id: appId,
      uid: uid || appId,
    },
    parameter: {
      chat: {
        domain,
        temperature,
        max_tokens: maxTokens,
      },
    },
    payload: {
      message: {
        text,
      },
    },
  }
}

/**
 * 轻量 WebSocket 客户端（支持流式拼接）
 * 使用方式：
 * const client = new SparkWSClient({ appId, apiKey, apiSecret })
 * await client.connect()
 * await client.sendText({ text, onDelta, onDone, onError })
 */
export class SparkWSClient {
  /**
   * @param {{appId:string, apiKey:string, apiSecret:string, uid?:string}} cfg
   */
  constructor(cfg) {
    this.cfg = cfg
    this.ws = null
    this._isConnecting = false
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  async connect() {
    if (this.connected) return
    if (this._isConnecting) return
    this._isConnecting = true
    try {
      const { apiKey, apiSecret } = this.cfg
      const wssUrl = await buildSparkWssUrl({ apiKey, apiSecret })
      this.ws = new WebSocket(wssUrl)
      await new Promise((resolve, reject) => {
        const ws = this.ws
        const onOpen = () => {
          cleanup()
          resolve()
        }
        const onError = () => {
          cleanup()
          reject(new Error('WebSocket 连接失败'))
        }
        const cleanup = () => {
          ws?.removeEventListener('open', onOpen)
          ws?.removeEventListener('error', onError)
        }
        ws.addEventListener('open', onOpen)
        ws.addEventListener('error', onError)
      })
    } finally {
      this._isConnecting = false
    }
  }

  close() {
    try {
      this.ws?.close()
    } catch {
      // ignore
    } finally {
      this.ws = null
    }
  }

  /**
   * 发送一轮对话（text 为已组装的历史数组）
   * @param {{
   *  text: Array<{role:'system'|'user'|'assistant', content:string}>,
   *  domain?:string,
   *  temperature?:number,
   *  maxTokens?:number,
   *  onDelta?:(delta:string)=>void,
   *  onDone?:()=>void,
   *  onError?:(err:Error)=>void,
   * }} args
   */
  async sendText(args) {
    assertNonEmpty(this.cfg?.appId, 'APPID')
    assertNonEmpty(this.cfg?.apiKey, 'APIKey')
    assertNonEmpty(this.cfg?.apiSecret, 'APISecret')

    await this.connect()
    if (!this.connected) throw new Error('WebSocket 未连接')

    const body = buildSparkRequestBody({
      appId: this.cfg.appId,
      uid: this.cfg.uid,
      text: args.text,
      domain: args.domain,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
    })

    const ws = this.ws
    const onDelta = args.onDelta || (() => {})
    const onDone = args.onDone || (() => {})
    const onError = args.onError || (() => {})

    return await new Promise((resolve, reject) => {
      let finished = false

      const cleanup = () => {
        ws.removeEventListener('message', handleMessage)
        ws.removeEventListener('error', handleError)
        ws.removeEventListener('close', handleClose)
      }

      const fail = (err) => {
        if (finished) return
        finished = true
        cleanup()
        onError(err)
        reject(err)
      }

      const succeed = () => {
        if (finished) return
        finished = true
        cleanup()
        onDone()
        resolve()
      }

      const handleError = () => fail(new Error('WebSocket 通信错误'))
      const handleClose = () => {
        if (!finished) fail(new Error('WebSocket 已关闭'))
      }

      const handleMessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          // 常见返回结构：
          // header: { code, message, status }
          // payload: { choices: { text: [{content,role,index}], status } }
          const code = data?.header?.code
          if (code && code !== 0) {
            fail(new Error(data?.header?.message || `服务端错误 code=${code}`))
            return
          }

          const delta = data?.payload?.choices?.text?.[0]?.content
          if (typeof delta === 'string' && delta.length) {
            onDelta(delta)
          }

          // choices.status：2 表示结束（常见约定）
          const status = data?.payload?.choices?.status
          if (status === 2) {
            succeed()
          }
        } catch (e) {
          fail(e instanceof Error ? e : new Error('解析服务端消息失败'))
        }
      }

      ws.addEventListener('message', handleMessage)
      ws.addEventListener('error', handleError)
      ws.addEventListener('close', handleClose)

      ws.send(JSON.stringify(body))
    })
  }
}

