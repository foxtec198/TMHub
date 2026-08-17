// React
import { createContext, useContext, useState } from 'react';
// PrimeReact
import { ProgressSpinner } from 'primereact/progressspinner';

// Compartilha uma única ação para controlar o bloqueio visual da aplicação.
const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
    const [loading, setLoading] = useState(false);

    return (
        <LoadingContext.Provider value={{ setLoading }}>
            {children}
            
            {/* Overlay Global de Tela Cheia */}
            {loading && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 99999, // Garante que fica acima de modais e menus
                    pointerEvents: 'all' // Bloqueia cliques na tela de fundo
                }}>
                    <ProgressSpinner strokeWidth="4" aria-label="Carregando..." />
                </div>
            )}
        </LoadingContext.Provider>
    );
}

export function useLoading() {
    // Impede o uso do hook fora do provedor que controla o overlay.
    const context = useContext(LoadingContext);
    if (!context) {
        throw new Error('useLoading deve ser utilizado dentro de um LoadingProvider');
    }
    return context.setLoading;
}
