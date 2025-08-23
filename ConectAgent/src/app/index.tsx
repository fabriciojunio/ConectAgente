import { View, Text, Button, StyleSheet, Image } from 'react-native'
import { router } from "expo-router"


export default function Login(){

    function homeAgente(){
        router.push("/Agente/home")
    }

    return(
        <View style={styles.container}>
            <Text>Página inicial de login</Text>

            <Button title='Login'onPress={homeAgente}/>

            <View>
                <image />
            </View>



        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 32,
        justifyContent: "center",
        gap: 16,
    },   
})