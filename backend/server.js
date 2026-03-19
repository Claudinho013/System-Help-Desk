require('dotenv').config()
const http = require('http')
const WebSocket = require('ws')
const app = require('./app')
const PORT = Number(process.env.PORT) || 3001

const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws, req) => {
  const url = req.url
  const params = new URLSearchParams(url.split('?')[1])
  const token = params.get('token')

  let userId = null
  if (token) {
    try {
      const base64Payload = token.split('.')[1]
      const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString())
      userId = payload.id
    } catch (err) {
      ws.close(1008, 'Invalid token')
      return
    }
  }

  if (!userId) {
    ws.close(1008, 'Token required')
    return
  }

  const wsConnections = app.locals?.wsConnections
  if (!wsConnections) {
    ws.close(1011, 'Server error')
    return
  }

  if (!wsConnections.has(userId)) {
    wsConnections.set(userId, new Set())
  }
  wsConnections.get(userId).add(ws)

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
      }
    } catch (err) {
      console.error('WebSocket message error:', err.message)
    }
  })

  ws.on('close', () => {
    const connections = wsConnections.get(userId)
    if (connections) {
      connections.delete(ws)
      if (connections.size === 0) {
        wsConnections.delete(userId)
      }
    }
  })

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message)
  })

  ws.send(JSON.stringify({ type: 'connected', userId, timestamp: new Date().toISOString() }))
})

server.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`)
  console.log(`WebSocket available at ws://localhost:${PORT}?token=<jwt>`)
})
