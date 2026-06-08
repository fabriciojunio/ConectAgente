import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.routes.js'
import userRoutes from './routes/user.routes.js'
import formRoutes from './routes/form.routes.js'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/users', userRoutes)
app.use('/forms', formRoutes)

app.get('/', (req, res) => {
  res.send('Backend ConectAgente rodando 🚀')
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.listen(3333, '0.0.0.0', () => {
  console.log('🚀 Backend rodando na porta 3333 em todas as interfaces');
})
