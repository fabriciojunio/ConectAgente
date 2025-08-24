import { TouchableOpacity, TouchableOpacityProps, Text, TextProps } from "react-native"
import { LinearGradient } from "expo-linear-gradient";

import { styles } from "./styles"

type Props = TouchableOpacityProps & {
    title: string
}

export function Button({ title, ...rest }: Props){
    return(
        // <TouchableOpacity activeOpacity={0.5} style={styles.button} {...rest}>
        //     <Text style={styles.title}>{title}</Text>
        // </TouchableOpacity>


    <TouchableOpacity style={styles.buttonContainer} {...rest}>
      <LinearGradient
        colors={["#003366", "#1E90FF"]} // degrade do azul escuro para azul claro
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.button}
      >
        <Text style={styles.text}>Login</Text>
      </LinearGradient>
    </TouchableOpacity>
    )
}