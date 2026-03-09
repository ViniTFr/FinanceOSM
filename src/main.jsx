import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Inicializa o Capacitor quando disponível
const initApp = async () => {
  // Importa plugins nativos do Capacitor (só funcionam no dispositivo)
  if (window.Capacitor) {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      await StatusBar.setStyle({ style: Style.Dark })
      await StatusBar.setBackgroundColor({ color: '#0d1b2a' })
    } catch (e) {
      // StatusBar não disponível no browser
    }

    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide()
    } catch (e) {
      // SplashScreen não disponível no browser
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

initApp()
