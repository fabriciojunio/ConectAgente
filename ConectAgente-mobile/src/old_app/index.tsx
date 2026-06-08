import { View, Text, Image } from 'react-native'
import { router } from "expo-router"
import React from 'react'

import { styles } from "./styles"
import { Button } from '../components/button'
import { Input } from '../components/input'


export default function Login(){

    function homeAgente(){
        router.push("./Agente/home")
    }

    return(
        <View style={styles.container}>

            <View style={styles.logo}>
                <Image source={require('../../assets/images/LOGO-remove-title.png')} style={styles.logo_img}/>
            </View>

            <View style={styles.form}>
                <Text>Login</Text>
                <Input placeholder="Digite seu login"/>
                <Text>Senha</Text>
                <Input placeholder="Digite sua senha"/>
                <Button title='Login'onPress={homeAgente}/>
            </View>



        </View>
    )
}