# 📱 Guia: FinanceOS → App Nativo (Android + iOS)

## O que foi feito no código
- ✅ Persistência de dados com `localStorage` (dados não se perdem ao fechar o app)
- ✅ Haptic feedback (vibração no celular ao registrar gastos)
- ✅ Safe area para notch/Dynamic Island do iPhone
- ✅ Status bar escura configurada
- ✅ Splash screen configurada
- ✅ `base: './'` no vite.config (obrigatório para o Capacitor)
- ✅ `overscroll-behavior` desativado (sem bounce estranho no celular)

---

## 🟢 PASSO 1 — Instalar dependências

Abra o terminal na pasta do projeto e rode:

```bash
npm install
```

---

## 🟢 PASSO 2 — Gerar o build

```bash
npm run build
```

Isso vai criar a pasta `dist/` com o app pronto.

---

## 🟢 PASSO 3 — Instalar e inicializar o Capacitor

```bash
npx cap init FinanceOS com.financeos.app --web-dir dist
```

---

## 🟢 PASSO 4 — Adicionar plataformas

**Android (funciona no Windows/Linux):**
```bash
npx cap add android
```

**iOS (só no Mac — ou use Codemagic na nuvem):**
```bash
npx cap add ios
```

---

## 🟢 PASSO 5 — Sincronizar o projeto

Sempre que fizer alterações no app, rode:
```bash
npm run build
npx cap sync
```
Ou use o atalho:
```bash
npm run deploy
```

---

## 🟢 PASSO 6 — Abrir no Android Studio

```bash
npx cap open android
```

No Android Studio:
1. Aguarde o Gradle sincronizar (pode demorar na primeira vez)
2. Conecte seu celular via USB com depuração USB ativada
3. Clique no botão ▶ (Run) para instalar no celular

---

## 📦 Gerar APK para instalar diretamente

No Android Studio:
- Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- O APK estará em: `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🍎 iOS SEM Mac — Usando Codemagic (gratuito)

1. Acesse: https://codemagic.io
2. Crie uma conta gratuita
3. Conecte seu repositório GitHub/GitLab
4. Suba o projeto com `git push`
5. Configure um workflow **Ionic Capacitor**
6. O Codemagic compila na nuvem e te entrega o `.ipa`

### Subir para o GitHub:
```bash
git init
git add .
git commit -m "FinanceOS app nativo"
git remote add origin https://github.com/SEU_USUARIO/financeos.git
git push -u origin main
```

---

## 📁 Estrutura de arquivos

```
financeos/
├── src/
│   ├── main.jsx          ← Entry point com Capacitor
│   └── App.jsx           ← Seu app completo
├── index.html
├── vite.config.js        ← base: './' configurado
├── capacitor.config.json ← Configuração do Capacitor
└── package.json          ← Todas as dependências
```

---

## ❓ Dúvidas comuns

**"O app não abre no Android Studio"**
→ Certifique-se de ter rodado `npm run build` antes de `npx cap sync`

**"Meus dados somem ao fechar o app"**
→ Já foi resolvido! O app usa `localStorage` para persistir tudo.

**"O teclado cobre os inputs no celular"**
→ Já configurado no `capacitor.config.json` com o plugin Keyboard.

**"Quero publicar na Play Store"**
→ No Android Studio: Build → Generate Signed Bundle/APK → Android App Bundle
→ Siga as instruções do Google Play Console: https://play.google.com/console
