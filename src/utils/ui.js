// Concentra formatações usadas na apresentação de valores e nomes.
export function to_real(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Number(value) || 0);
}

export function capitalize(text){
    const first_letter = text[0].toUpperCase()
    return first_letter + text.toLowerCase().slice(1, text.length)
}

export function get_first_name(name, cap=true){
    const first = name.toString().split(" ")[0]
    return cap
        ? capitalize(first)
        : first
}

export function getSocialName(name, cap=true){
    const breaked_name = name.split(" ")
    const socialize = `${breaked_name[0]} ${breaked_name.at(-1)}`
    return cap
        ? capitalize(socialize)
        : socialize
}

export const deny_roles = ["User"]
export const allow_roles = ["Admin"]