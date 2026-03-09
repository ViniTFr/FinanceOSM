# 💰 FinanceOS — App de Controle Financeiro

App de finanças pessoais com suporte nativo para **Android** e **iOS** via Capacitor.

## 🚀 Como rodar

### Pré-requisitos
- Node.js 18+ → https://nodejs.org
- Android Studio → https://developer.android.com/studio (para Android)

### Instalar e buildar
```bash
npm install
npm run build
```

### Android
```bash
npx cap add android
npx cap sync
npx cap open android
```
No Android Studio: **Build → Build APK(s)**

### iOS (via Codemagic — sem precisar de Mac)
1. Sobe no GitHub
2. Conecta no https://codemagic.io
3. O arquivo `codemagic.yaml` já está configurado

### Atualizar após mudanças
```bash
npm run deploy
```

## 📁 Estrutura
```
src/
├── main.jsx       ← Entry point + Capacitor init
└── App.jsx        ← App completo
capacitor.config.json
codemagic.yaml     ← Config build iOS na nuvem
```
