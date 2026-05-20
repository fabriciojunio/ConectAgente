import { StyleSheet } from "react-native";

import { LinearGradient } from "expo-linear-gradient";

export const styles = StyleSheet.create({
    buttonContainer: {
        borderRadius: 25,
        overflow: "hidden", // importante para o degradê acompanhar o borderRadius
        marginTop: 20,
    },
    button: {
        height: 50,
        justifyContent: "center",
        alignItems: "center",
    },
    text: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
})