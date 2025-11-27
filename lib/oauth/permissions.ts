interface ScopeKeys {
    [key: string]: string;
}

export interface Scope {
    key: string;
    description: string;
}

const scopes = {
    "pagina_inicial.dashboard_geral": "Pagina inicial do dashboard (admin geral)",

    // Menu usuarios
    "usuarios.leitura": "Ler usuários",
    "usuarios.editar": "Editar usuários",

    "loteamentos.leitura": "Ler loteamentos",
    "loteamentos.editar": "Editar loteamentos",

    "reservas.leitura": "Ler reservas",
    "reservas.editar": "Editar reservas",
    
}

function getAllAvailableScopes(): Scope[] {
    return Object.keys(scopes).map((key) => {
        return {
            key: key,
            // @ts-ignore
            description: scopes[key]
        }
    })
}

function isScopeAuthorized(scope: string, userScopes: string[]): boolean {
    if (userScopes.includes('*')) {
        return true;
    }
    return userScopes.includes(scope);
}

export {
    scopes,
    isScopeAuthorized,
    getAllAvailableScopes
};