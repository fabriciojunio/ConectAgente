import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

export async function registerAgent(req, res) {
  const { nome, cpf, matricula, usuario, senha, cepVisitas } = req.body

  const hash = await bcrypt.hash(senha, 10)

  const agent = await prisma.agente.create({
    data: {
      nome,
      cpf,
      matricula,
      usuario,
      senha: hash,
      cepVisitas
    }
  })

  res.json(agent)
}

export async function loginAgent(req, res) {
  const { cpf, senha } = req.body

  const agent = await prisma.agente.findUnique({ where: { cpf } })
  if (!agent) return res.status(401).json({ error: 'Agente não encontrado' })

  const valid = await bcrypt.compare(senha, agent.senha)
  if (!valid) return res.status(401).json({ error: 'Senha inválida' })

  const token = jwt.sign(
    { id: agent.id, role: 'agent' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  )

  res.json({ token, agent })
}

export async function getAgents(req, res) {
  const agents = await prisma.agente.findMany()
  res.json(agents)
}

export async function updateAgent(req, res) {
  const { id } = req.params
  const { nome, cpf, matricula, usuario, senha, cepVisitas } = req.body

  const data = { nome, cpf, matricula, usuario, cepVisitas }
  if (senha) {
    data.senha = await bcrypt.hash(senha, 10)
  }

  const agent = await prisma.agente.update({
    where: { id: parseInt(id) },
    data
  })

  res.json(agent)
}

export async function deleteAgent(req, res) {
  const { id } = req.params
  await prisma.agente.delete({ where: { id: parseInt(id) } })
  res.json({ message: 'Agente deletado' })
}
