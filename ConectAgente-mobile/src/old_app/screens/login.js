import { useState } from 'react'
import { View, TextInput, Button, Text } from 'react-native'
import axios from 'axios'

export default function Login({ navigation }) {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')

  async function handleLogin() {
    const res = await axios.post('http://IP:3333/auth/login', {
      email, senha
    })

    if (res.data.token) {
      navigation.navigate('Home')
    }
  }

  return (
    <View>
      <Text>Email</Text>
      <TextInput onChangeText={setEmail} />

      <Text>Senha</Text>
      <TextInput secureTextEntry onChangeText={setSenha} />

      <Button title="Entrar" onPress={handleLogin} />
    </View>
  )
}
