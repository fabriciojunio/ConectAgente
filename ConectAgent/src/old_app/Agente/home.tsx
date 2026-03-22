import { View, Text, Button, StyleSheet } from "react-native"
import { router } from "expo-router"


export default function HomeAgente(){
    return(
        <View style={styles.container}>
            <View >
                <Text>Home agente</Text>
                <Button title="Voltar" onPress={() => router.back()} /> 
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