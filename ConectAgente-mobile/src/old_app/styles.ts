import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        // justifyContent: "center",
     
        backgroundColor: "#dae9efc7",
    },   

    logo: {
        flex: 4,
        // padding: 64,
        justifyContent: "center",
        alignItems: "center",
        // gap: 16,
        
    },

    logo_img: {
        resizeMode: 'contain',
    },

    form: {
        flex: 3,
        backgroundColor: "#FFF",
        borderTopLeftRadius: 50,
        borderTopRightRadius: 50,
        paddingTop: 50,
        paddingRight: 20,
        paddingLeft: 20,
        gap: 13,
    }
 
})
