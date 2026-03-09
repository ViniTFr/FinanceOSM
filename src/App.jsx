import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

// ── Detecta se está rodando como app nativo ──
const isNative = () => typeof window !== 'undefined' && !!window.Capacitor?.isNative;

// ── Haptic feedback (vibra no celular) ──
const haptic = async (type = 'light') => {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    if (type === 'light') await Haptics.impact({ style: ImpactStyle.Light });
    if (type === 'medium') await Haptics.impact({ style: ImpactStyle.Medium });
    if (type === 'success') await Haptics.notification({ type: 'SUCCESS' });
  } catch (e) {}
};

// ── Persistência local com localStorage ──
const storage = {
  get: (key, defaultVal) => {
    try {
      const v = localStorage.getItem('financeos_' + key);
      return v !== null ? JSON.parse(v) : defaultVal;
    } catch { return defaultVal; }
  },
  set: (key, val) => {
    try { localStorage.setItem('financeos_' + key, JSON.stringify(val)); } catch {}
  }
};

const DEFAULT_CATEGORIES = [
  { id: 1, name: "Alimentação", icon: "🍔", color: "#FF6B6B" },
  { id: 2, name: "Transporte", icon: "🚗", color: "#4ECDC4" },
  { id: 3, name: "Moradia", icon: "🏠", color: "#45B7D1" },
  { id: 4, name: "Saúde", icon: "💊", color: "#96CEB4" },
  { id: 5, name: "Lazer", icon: "🎮", color: "#FFEAA7" },
  { id: 6, name: "Educação", icon: "📚", color: "#DDA0DD" },
  { id: 7, name: "Vestuário", icon: "👗", color: "#98D8C8" },
  { id: 8, name: "Assinaturas", icon: "📱", color: "#F7DC6F" },
];
const INVESTMENT_TYPES = ["Ações","FIIs","Tesouro Direto","CDB","Poupança","Criptomoedas","ETFs","Outros"];
const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function formatCurrency(v) {
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
}
function removeAccents(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}
function isSimilar(a,b) {
  const ra=removeAccents(a), rb=removeAccents(b);
  if(ra.includes(rb)||rb.includes(ra)) return true;
  if(ra.length>=4&&rb.length>=4&&(ra.startsWith(rb.slice(0,4))||rb.startsWith(ra.slice(0,4)))) return true;
  return false;
}
const CATEGORY_KEYWORDS = {
  "Alimentação":["comida","lanche","almoço","jantar","café","restaurante","pizza","hamburguer","ifood","rappi","padaria","mercado","supermercado","feira","salgado","refeição","marmita","delivery","sushi","churrasco","açougue"],
  "Transporte":["uber","99","cabify","ônibus","metro","gasolina","combustível","estacionamento","taxi","transporte","passagem","pedágio","oficina","mecânico","pneu","óleo","carro","moto","bicicleta","trem","avião","posto"],
  "Moradia":["aluguel","condomínio","água","luz","energia","internet","gás","iptu","reforma","móveis","casa","apartamento","encanador","eletricista","faxina","diarista","limpeza"],
  "Saúde":["farmácia","médico","consulta","remédio","academia","plano","exame","hospital","dentista","psicólogo","fisioterapia","vacina","nutricionista","suplemento","vitamina","laboratório","clínica"],
  "Lazer":["netflix","amazon","disney","hbo","spotify","deezer","cinema","show","jogo","bar","balada","viagem","hotel","passeio","parque","clube","games","videogame","festa","ingresso","teatro","praia"],
  "Educação":["curso","livro","faculdade","escola","material","udemy","alura","mensalidade","matrícula","treinamento","workshop","universidade","creche","aula","professor"],
  "Vestuário":["roupa","sapato","tênis","camiseta","calça","vestido","bermuda","jaqueta","casaco","bolsa","mochila","óculos","relógio","shopping"],
  "Assinaturas":["assinatura","netflix","spotify","amazon","apple","google","microsoft","adobe","dropbox","icloud","celular","telefone","antivirus","vpn","hospedagem"],
};

function parseNaturalLanguage(text, userCategories=[]) {
  const lowerClean = removeAccents(text);
  let amount = null;
  const amountMatch = text.match(/r?\$?\s*(\d+(?:[.,]\d{1,2})?)/i);
  if(amountMatch) amount = parseFloat(amountMatch[1].replace(",","."));
  const descMatch = text.match(/(?:gastei|paguei|comprei|fiz|custou|cobrou|saiu|com|em|no|na|para|do|da)\s+([a-zA-ZÀ-ú\s]+?)(?:\s+r?\$|\s+\d|,|\.|$)/i);
  const stopwords = ["gastei","paguei","comprei","fiz","custou","cobrou","saiu","com","em","no","na","para","do","da","de","um","uma","o","a","os","as","que","por","mais","muito","hoje","ontem","agora","reais","real"];
  const description = descMatch ? descMatch[1].trim() : text.replace(/\d+([.,]\d+)?/g,"").replace(/r\$|reais|real/gi,"").trim().slice(0,40)||text.slice(0,40);
  const words = lowerClean.split(/\s+/).filter(w=>w.length>2&&!stopwords.includes(w));
  let bestCategory=null, bestScore=0;
  for(const cat of userCategories){
    const catName=removeAccents(cat.name);
    for(const word of words){
      if(isSimilar(word,catName)){if(100>bestScore){bestScore=100;bestCategory=cat.name;}}
    }
    if(isSimilar(lowerClean,catName)){if(100>bestScore){bestScore=100;bestCategory=cat.name;}}
  }
  if(bestScore<100){
    for(const [catName,keywords] of Object.entries(CATEGORY_KEYWORDS)){
      const userCat=userCategories.find(c=>removeAccents(c.name)===removeAccents(catName));
      if(!userCat) continue;
      for(const kw of keywords){
        const kwClean=removeAccents(kw);
        if(lowerClean.includes(kwClean)){if(80>bestScore){bestScore=80;bestCategory=catName;}}
        for(const word of words){if(isSimilar(word,kwClean)){if(60>bestScore){bestScore=60;bestCategory=catName;}}}
      }
    }
  }
  if(!bestCategory&&userCategories.length>0) bestCategory=userCategories[0].name;
  return {amount, category:bestCategory||"Alimentação", description:description||text.slice(0,40)};
}

export default function FinanceApp() {
  const now = new Date();
  const [tab, setTab] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [reportMonth, setReportMonth] = useState(now.getMonth());
  const [reportYear, setReportYear] = useState(now.getFullYear());

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showSetMonthlyIncome, setShowSetMonthlyIncome] = useState(false);

  const [monthlyIncomeConfig, setMonthlyIncomeConfig] = useState(() =>
    storage.get('monthlyConfig', { enabled: false, amount: "", description: "Salário", dayOfMonth: 5 })
  );
  const [tempMonthlyConfig, setTempMonthlyConfig] = useState({ amount:"", description:"Salário", dayOfMonth:5 });

  const [expenses, setExpenses] = useState(() =>
    storage.get('expenses', [
      { id:1, description:"Supermercado", amount:320.5, category:"Alimentação", date:"2025-03-01" },
      { id:2, description:"Uber", amount:45.0, category:"Transporte", date:"2025-03-02" },
      { id:3, description:"Netflix", amount:55.9, category:"Assinaturas", date:"2025-03-03" },
      { id:4, description:"Farmácia", amount:89.0, category:"Saúde", date:"2025-03-05" },
      { id:5, description:"Restaurante", amount:120.0, category:"Alimentação", date:"2025-03-07" },
      { id:6, description:"Aluguel", amount:1800.0, category:"Moradia", date:"2025-03-08" },
    ])
  );
  const [investments, setInvestments] = useState(() =>
    storage.get('investments', [
      { id:1, name:"PETR4", type:"Ações", amount:5000, returnPct:12.5 },
      { id:2, name:"HGLG11", type:"FIIs", amount:3000, returnPct:8.2 },
      { id:3, name:"Tesouro IPCA+", type:"Tesouro Direto", amount:10000, returnPct:6.8 },
    ])
  );
  const [categories, setCategories] = useState(() =>
    storage.get('categories', DEFAULT_CATEGORIES)
  );
  const [incomeTransactions, setIncomeTransactions] = useState(() =>
    storage.get('income', [
      { id:1, description:"Salário", amount:8000, date:"2025-03-05", isMonthly:false },
    ])
  );
  const [messages, setMessages] = useState([
    { role:"ai", text:"👋 Olá! Sou seu assistente financeiro.\n\nRegistre receitas e gastos:\n💚 \"Ganhei 3000 de salário\"\n💸 \"Gastei 45 no Uber\"\n\nOu pergunte: \"Qual meu saldo?\" • \"Relatório do mês\"" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [newExpense, setNewExpense] = useState({ description:"", amount:"", category:"Alimentação", date:now.toISOString().split("T")[0] });
  const [newInvestment, setNewInvestment] = useState({ name:"", type:"Ações", amount:"", returnPct:"" });
  const [newCategory, setNewCategory] = useState({ name:"", icon:"💡", color:"#FF6B6B" });
  const [newIncome, setNewIncome] = useState({ description:"", amount:"", date:now.toISOString().split("T")[0] });
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef(null);

  // ── Persiste dados automaticamente ──
  useEffect(() => { storage.set('expenses', expenses); }, [expenses]);
  useEffect(() => { storage.set('investments', investments); }, [investments]);
  useEffect(() => { storage.set('categories', categories); }, [categories]);
  useEffect(() => { storage.set('income', incomeTransactions); }, [incomeTransactions]);
  useEffect(() => { storage.set('monthlyConfig', monthlyIncomeConfig); }, [monthlyIncomeConfig]);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages]);
  useEffect(() => {
    if(!sidebarOpen) return;
    const h = (e) => { if(e.target.id==="sidebar-overlay") setSidebarOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [sidebarOpen]);

  const totalExpenses = expenses.reduce((s,e)=>s+e.amount,0);
  const totalInvestments = investments.reduce((s,i)=>s+i.amount,0);
  const totalIncome = incomeTransactions.reduce((s,r)=>s+r.amount,0);
  const balance = totalIncome - totalExpenses;

  const expensesByCategory = categories.map(cat=>({
    name:cat.name, value:expenses.filter(e=>e.category===cat.name).reduce((s,e)=>s+e.amount,0),
    color:cat.color, icon:cat.icon
  })).filter(c=>c.value>0);

  const getMonthData = (month, year) => {
    const monthStr = `${year}-${String(month+1).padStart(2,"0")}`;
    const mExpenses = expenses.filter(e=>e.date.startsWith(monthStr));
    const mIncome = incomeTransactions.filter(r=>r.date.startsWith(monthStr));
    const totalExp = mExpenses.reduce((s,e)=>s+e.amount,0);
    const totalInc = mIncome.reduce((s,r)=>s+r.amount,0);
    let configInc = 0;
    if(monthlyIncomeConfig.enabled && parseFloat(monthlyIncomeConfig.amount)>0) {
      const alreadyHas = mIncome.some(r=>r.isMonthly);
      if(!alreadyHas) configInc = parseFloat(monthlyIncomeConfig.amount);
    }
    const totalIncFinal = totalInc + configInc;
    const byCategory = categories.map(cat=>({
      name:cat.name, icon:cat.icon, color:cat.color,
      value:mExpenses.filter(e=>e.category===cat.name).reduce((s,e)=>s+e.amount,0)
    })).filter(c=>c.value>0).sort((a,b)=>b.value-a.value);
    return { totalExp, totalInc:totalIncFinal, balance:totalIncFinal-totalExp, expenses:mExpenses, income:mIncome, byCategory };
  };

  const last6 = Array.from({length:6},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-5+i, 1);
    const data = getMonthData(d.getMonth(), d.getFullYear());
    return { month:MONTH_SHORT[d.getMonth()], gastos:data.totalExp, receita:data.totalInc||monthlyIncomeConfig.enabled?parseFloat(monthlyIncomeConfig.amount)||0:0 };
  });

  const sendMessage = async () => {
    if(!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setMessages(prev=>[...prev,{role:"user",text:userMsg}]);
    setIsTyping(true);
    await haptic('light');
    await new Promise(r=>setTimeout(r,700));
    const parsed = parseNaturalLanguage(userMsg, categories);
    const lower = userMsg.toLowerCase();
    let aiText = "";
    const totalExp = expenses.reduce((s,e)=>s+e.amount,0);
    const totalInv = investments.reduce((s,i)=>s+i.amount,0);
    const totalInc = incomeTransactions.reduce((s,r)=>s+r.amount,0);
    const bal = totalInc - totalExp;
    const isIncome = /ganhei|recebi|entrou|salário|salario|renda|freelance|freela|bônus|bonus|comissão|comissao|pagamento|depositaram|caiu na conta/.test(lower);

    if(parsed.amount&&parsed.amount>0&&isIncome){
      const descInc = parsed.description||"Receita";
      setIncomeTransactions(prev=>[...prev,{id:Date.now(),description:descInc,amount:parsed.amount,date:new Date().toISOString().split("T")[0],isMonthly:false}]);
      await haptic('success');
      aiText = `💚 Receita registrada!\n\n📝 *${descInc}*\n✅ *+${formatCurrency(parsed.amount)}*\n\nTotal do mês: *${formatCurrency(totalInc+parsed.amount)}* 🎯`;
    } else if(parsed.amount&&parsed.amount>0&&/gast|pagu|comprei|custou|cobr|saiu|fiz/.test(lower)){
      const cat = categories.find(c=>c.name===parsed.category)||categories[0];
      setExpenses(prev=>[...prev,{id:Date.now(),description:parsed.description||userMsg,amount:parsed.amount,category:cat.name,date:new Date().toISOString().split("T")[0]}]);
      await haptic('medium');
      const pct = totalInc>0?((parsed.amount/totalInc)*100).toFixed(1):"--";
      const tips = {"Alimentação":"Cozinhar em casa reduz até 60%!","Transporte":"Considere transporte público.","Lazer":"Estabeleça um limite mensal!","Assinaturas":"Revise suas assinaturas.","Saúde":"Saúde em dia, sempre!","Moradia":"Ideal: até 30% da renda.","Educação":"Ótimo investimento!","Vestuário":"Compras planejadas economizam!"};
      aiText = `✅ Anotado!\n\n📝 *${parsed.description||"Gasto"}*\n💰 *${formatCurrency(parsed.amount)}*\n📂 *${cat.icon} ${cat.name}*\n\n${pct!=="--"?`Representa ${pct}% da renda.`:""}\n\n💡 ${tips[cat.name]||"Continue anotando tudo!"}`;
    } else if(/relat|mensal|mês|mes|resumo do mês/.test(lower)){
      const d = getMonthData(now.getMonth(), now.getFullYear());
      const topCat = d.byCategory[0];
      const status = d.balance>=0?"✅ Superávit":"⚠️ Déficit";
      aiText = `📋 Relatório de ${MONTH_NAMES[now.getMonth()]}/${now.getFullYear()}\n\n💚 Receitas: *${formatCurrency(d.totalInc)}*\n💸 Gastos: *${formatCurrency(d.totalExp)}*\n💰 Saldo: *${formatCurrency(d.balance)}* ${status}\n\n${topCat?`🔝 Maior gasto: *${topCat.icon} ${topCat.name}* — ${formatCurrency(topCat.value)}`:"Nenhum gasto ainda!"}`;
    } else if(/saldo|sobr|quanto (tenho|sobrou|resta)|situação/.test(lower)){
      aiText = bal>=0?`💰 Saldo: *${formatCurrency(bal)}*\n\nReceitas: ${formatCurrency(totalInc)} | Gastos: ${formatCurrency(totalExp)}\nNo azul! ✅`:`⚠️ Saldo negativo: *${formatCurrency(bal)}*\n\nReceitas: ${formatCurrency(totalInc)} | Gastos: ${formatCurrency(totalExp)}\nHora de cortar gastos!`;
    } else if(/quanto (gast|invest)|total|resumo/.test(lower)){
      aiText = `📊 Resumo:\n💚 Receitas: *${formatCurrency(totalInc)}*\n💸 Gastos: *${formatCurrency(totalExp)}*\n📈 Investido: *${formatCurrency(totalInv)}*\n💰 Saldo: *${formatCurrency(bal)}*`;
    } else if(/invest|ação|fii|tesouro|carteira|ativo/.test(lower)){
      const totalRet = investments.reduce((s,i)=>s+i.amount*i.returnPct/100,0);
      aiText = `📈 Carteira: *${investments.length} ativos*\nTotal: *${formatCurrency(totalInv)}*\nRetorno: *${formatCurrency(totalRet)}* 🎯`;
    } else if(/dica|conselho|como economiz/.test(lower)){
      const tips=["Regra 50/30/20: 50% necessidades, 30% desejos, 20% investimentos.","Crie reserva de emergência de 3 a 6 meses.","Anote TODOS os gastos, até os pequenos!","Revise assinaturas mensalmente.","Invista antes de gastar — pague-se primeiro!"];
      aiText = "💡 "+tips[Math.floor(Math.random()*tips.length)];
    } else if(/oi|olá|ola|bom dia|boa tarde|boa noite|hey/.test(lower)){
      const h=new Date().getHours();
      aiText = (h<12?"Bom dia":h<18?"Boa tarde":"Boa noite")+"! 👋\n\nComo posso ajudar?";
    } else {
      aiText = "Não entendi 😊 Tente:\n• \"Ganhei 500 de freela\"\n• \"Gastei 50 no almoço\"\n• \"Qual meu saldo?\"\n• \"Relatório do mês\"";
    }
    setIsTyping(false);
    setMessages(prev=>[...prev,{role:"ai",text:aiText}]);
  };

  const addIncomeTransaction = () => {
    if(!newIncome.description||!newIncome.amount) return;
    setIncomeTransactions(prev=>[...prev,{...newIncome,id:Date.now(),amount:parseFloat(newIncome.amount),isMonthly:false}]);
    setNewIncome({description:"",amount:"",date:now.toISOString().split("T")[0]});
    setShowAddIncome(false);
    haptic('success');
  };
  const saveMonthlyIncome = () => {
    if(!tempMonthlyConfig.amount) return;
    const cfg = {...tempMonthlyConfig, enabled:true, amount:parseFloat(tempMonthlyConfig.amount)};
    setMonthlyIncomeConfig(cfg);
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
    const already = incomeTransactions.some(r=>r.isMonthly&&r.date.startsWith(monthStr));
    if(!already){
      const day = String(Math.min(cfg.dayOfMonth,28)).padStart(2,"0");
      setIncomeTransactions(prev=>[...prev,{id:Date.now(),description:cfg.description,amount:parseFloat(cfg.amount),date:`${monthStr}-${day}`,isMonthly:true}]);
    }
    setShowSetMonthlyIncome(false);
    haptic('success');
  };
  const addExpense = () => {
    if(!newExpense.description||!newExpense.amount) return;
    setExpenses(prev=>[...prev,{...newExpense,id:Date.now(),amount:parseFloat(newExpense.amount)}]);
    setNewExpense({description:"",amount:"",category:"Alimentação",date:now.toISOString().split("T")[0]});
    setShowAddExpense(false);
    haptic('medium');
  };
  const addInvestment = () => {
    if(!newInvestment.name||!newInvestment.amount) return;
    setInvestments(prev=>[...prev,{...newInvestment,id:Date.now(),amount:parseFloat(newInvestment.amount),returnPct:parseFloat(newInvestment.returnPct)||0}]);
    setNewInvestment({name:"",type:"Ações",amount:"",returnPct:""});
    setShowAddInvestment(false);
    haptic('success');
  };
  const addCategory = () => {
    if(!newCategory.name) return;
    setCategories(prev=>[...prev,{...newCategory,id:Date.now()}]);
    setNewCategory({name:"",icon:"💡",color:"#FF6B6B"});
    setShowAddCategory(false);
  };

  const CustomTooltip = ({active,payload}) => {
    if(active&&payload?.length) return(
      <div style={{background:"#0d1b2a",border:"1px solid #1a2744",borderRadius:8,padding:"8px 12px"}}>
        <p style={{color:"#e2e8f0",margin:0,fontSize:12}}>{payload[0].name}: <strong style={{color:"#4fc3f7"}}>{formatCurrency(payload[0].value)}</strong></p>
      </div>
    );
    return null;
  };

  const inp = {width:"100%",padding:"12px 14px",borderRadius:12,border:"1px solid #1a2744",background:"#060d1a",color:"#e2e8f0",fontSize:15,outline:"none",boxSizing:"border-box"};
  const btnP = {padding:"12px 20px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#4fc3f7,#0288d1)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14};
  const btnS = {padding:"12px 20px",borderRadius:12,border:"1px solid #1a2744",background:"transparent",color:"#94a3b8",cursor:"pointer",fontSize:14};
  const card = {background:"linear-gradient(135deg,#0d1b2a,#0a1628)",border:"1px solid #1a2744",borderRadius:16,padding:16};
  const btnG = {padding:"12px 20px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#4ade80,#16a34a)",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:14};

  const tabs = [
    {id:"dashboard",label:"Dashboard",icon:"📊"},
    {id:"expenses",label:"Gastos",icon:"💸"},
    {id:"investments",label:"Carteira",icon:"📈"},
    {id:"report",label:"Relatório",icon:"📋"},
    {id:"chat",label:"Assistente",icon:"💬"},
  ];

  const reportData = getMonthData(reportMonth, reportYear);
  const isDesktop = !isMobile;

  const navigateTo = (id) => { setTab(id); setSidebarOpen(false); haptic('light'); };

  // ── Safe area para notch/island ──
  const safeTop = isNative() ? 'env(safe-area-inset-top, 0px)' : '0px';

  return (
    <div style={{minHeight:"100vh",background:"#060d1a",fontFamily:"'Poppins',sans-serif",color:"#e2e8f0",display:"flex",flexDirection:"column"}}>

      {sidebarOpen && (
        <div id="sidebar-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,backdropFilter:"blur(2px)"}}/>
      )}

      {/* SIDEBAR */}
      <div style={{
        position:"fixed", top:0, left:0, height:"100%", width:260,
        background:"linear-gradient(180deg,#0d1b2a 0%,#060d1a 100%)",
        borderRight:"1px solid #1a2744", zIndex:400,
        transform:sidebarOpen?"translateX(0)":"translateX(-100%)",
        transition:"transform 0.3s cubic-bezier(.4,0,.2,1)",
        display:"flex", flexDirection:"column", overflowY:"auto",
        paddingTop:safeTop
      }}>
        <div style={{padding:"20px 20px 16px",borderBottom:"1px solid #1a2744",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#4fc3f7,#0288d1)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#fff",fontSize:16}}>$</div>
            <div>
              <div style={{fontSize:15,fontWeight:700,color:"#f1f5f9"}}>FinanceOS</div>
              <div style={{fontSize:10,color:"#64748b"}}>Controle Financeiro</div>
            </div>
          </div>
          <button onClick={()=>setSidebarOpen(false)} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:20,padding:4}}>✕</button>
        </div>
        <div style={{padding:"12px 12px",flex:1}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>navigateTo(t.id)} style={{
              width:"100%", display:"flex", alignItems:"center", gap:12,
              padding:"12px 14px", borderRadius:12, border:"none", cursor:"pointer",
              background:tab===t.id?"linear-gradient(135deg,#4fc3f722,#0288d111)":"transparent",
              color:tab===t.id?"#4fc3f7":"#94a3b8",
              fontFamily:"'Poppins',sans-serif", fontSize:14, fontWeight:tab===t.id?700:500,
              marginBottom:4, transition:"all 0.15s", textAlign:"left",
              borderLeft:tab===t.id?"3px solid #4fc3f7":"3px solid transparent"
            }}>
              <span style={{fontSize:18}}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{padding:"16px",borderTop:"1px solid #1a2744"}}>
          <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>RENDA MENSAL RECORRENTE</div>
          {monthlyIncomeConfig.enabled ? (
            <div style={{background:"#0a1f0f",border:"1px solid #4ade8022",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:12,color:"#4ade80",fontWeight:700}}>{monthlyIncomeConfig.description}</div>
              <div style={{fontSize:16,fontWeight:800,color:"#4ade80"}}>{formatCurrency(parseFloat(monthlyIncomeConfig.amount)||0)}</div>
              <div style={{fontSize:10,color:"#64748b"}}>Todo dia {monthlyIncomeConfig.dayOfMonth}</div>
              <button onClick={()=>{setTempMonthlyConfig({...monthlyIncomeConfig});setShowSetMonthlyIncome(true);}} style={{marginTop:8,fontSize:11,color:"#4fc3f7",background:"none",border:"none",cursor:"pointer",padding:0}}>✏️ Editar</button>
            </div>
          ) : (
            <button onClick={()=>{setShowSetMonthlyIncome(true);}} style={{...btnG,width:"100%",fontSize:12,padding:"10px"}}>
              + Configurar Renda Mensal
            </button>
          )}
        </div>
      </div>

      {/* HEADER */}
      <div style={{background:"#0d1b2a",borderBottom:"1px solid #1a2744",padding:isMobile?"12px 16px":"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:200,paddingTop:`calc(${safeTop} + ${isMobile?"12px":"14px"})`}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={()=>setSidebarOpen(true)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 6px",color:"#94a3b8",fontSize:20,lineHeight:1,display:"flex",flexDirection:"column",gap:4}}>
            <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:1}}/>
            <span style={{display:"block",width:14,height:2,background:"currentColor",borderRadius:1}}/>
            <span style={{display:"block",width:20,height:2,background:"currentColor",borderRadius:1}}/>
          </button>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:30,height:30,borderRadius:8,background:"linear-gradient(135deg,#4fc3f7,#0288d1)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,color:"#fff",fontSize:14}}>$</div>
            <span style={{fontSize:15,fontWeight:700,color:"#f1f5f9"}}>FinanceOS</span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#64748b"}}>RECEITAS</div>
            <div style={{fontSize:13,fontWeight:700,color:"#4ade80"}}>{formatCurrency(totalIncome)}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"#64748b"}}>SALDO</div>
            <div style={{fontSize:13,fontWeight:700,color:balance>=0?"#4fc3f7":"#f87171"}}>{formatCurrency(balance)}</div>
          </div>
        </div>
      </div>

      {isDesktop && (
        <div style={{display:"flex",gap:4,padding:"10px 24px",background:"#0a1220",borderBottom:"1px solid #1a2744"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"7px 16px",borderRadius:10,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,background:tab===t.id?"#4fc3f722":"transparent",color:tab===t.id?"#4fc3f7":"#64748b",borderBottom:tab===t.id?"2px solid #4fc3f7":"2px solid transparent",transition:"all 0.2s",fontFamily:"'Poppins',sans-serif"}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      )}

      {/* MODAL: Config Renda Mensal */}
      {showSetMonthlyIncome && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{...card,width:"100%",maxWidth:400,padding:24}}>
            <div style={{fontSize:16,fontWeight:700,color:"#f1f5f9",marginBottom:4}}>💚 Renda Mensal Recorrente</div>
            <div style={{fontSize:12,color:"#64748b",marginBottom:20}}>Configure para registrar automaticamente todo mês</div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <input placeholder="Descrição (ex: Salário CLT)" value={tempMonthlyConfig.description} onChange={e=>setTempMonthlyConfig(p=>({...p,description:e.target.value}))} style={inp}/>
              <input placeholder="Valor (R$)" type="number" value={tempMonthlyConfig.amount} onChange={e=>setTempMonthlyConfig(p=>({...p,amount:e.target.value}))} style={inp}/>
              <div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:6}}>Dia do mês que cai</div>
                <input type="number" min="1" max="28" placeholder="Dia (1-28)" value={tempMonthlyConfig.dayOfMonth} onChange={e=>setTempMonthlyConfig(p=>({...p,dayOfMonth:parseInt(e.target.value)||1}))} style={inp}/>
              </div>
              <div style={{display:"flex",gap:8,marginTop:4}}>
                <button onClick={saveMonthlyIncome} style={{...btnG,flex:1}}>Salvar</button>
                <button onClick={()=>setShowSetMonthlyIncome(false)} style={{...btnS,flex:1}}>Cancelar</button>
              </div>
              {monthlyIncomeConfig.enabled&&(
                <button onClick={()=>{setMonthlyIncomeConfig({enabled:false,amount:"",description:"Salário",dayOfMonth:5});setShowSetMonthlyIncome(false);}} style={{...btnS,width:"100%",color:"#f87171",borderColor:"#f8717144",fontSize:12}}>
                  Desativar renda recorrente
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO PRINCIPAL */}
      <div style={{padding:isMobile?"14px":"24px",maxWidth:1100,margin:"0 auto",width:"100%",paddingBottom:isMobile?`calc(90px + env(safe-area-inset-bottom))`:24}}>

        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              {[
                {label:"Receita",value:totalIncome,color:"#4ade80",icon:"💰",sub:`${incomeTransactions.length} lançamento(s)`},
                {label:"Gastos",value:totalExpenses,color:"#f87171",icon:"💸",sub:`${totalIncome>0?((totalExpenses/totalIncome)*100).toFixed(0):0}% da renda`},
                {label:"Saldo",value:balance,color:balance>=0?"#4ade80":"#f87171",icon:"🏦",sub:balance>=0?"No azul ✅":"No vermelho ⚠️"},
                {label:"Investido",value:totalInvestments,color:"#a78bfa",icon:"📈",sub:`${investments.length} ativos`},
              ].map((c,i)=>(
                <div key={i} style={{...card,position:"relative",overflow:"hidden"}}>
                  <div style={{position:"absolute",top:-6,right:-4,fontSize:34,opacity:0.07}}>{c.icon}</div>
                  <div style={{fontSize:10,color:"#64748b",marginBottom:4,letterSpacing:0.5}}>{c.label.toUpperCase()}</div>
                  <div style={{fontSize:isMobile?14:20,fontWeight:800,color:c.color}}>{formatCurrency(c.value)}</div>
                  <div style={{fontSize:10,color:"#475569",marginTop:2}}>{c.sub}</div>
                </div>
              ))}
            </div>
            <div style={{...card,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:10}}>📊 Receita vs Gastos (6 meses)</div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={last6}>
                  <defs>
                    <linearGradient id="cR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/><stop offset="95%" stopColor="#4ade80" stopOpacity={0}/></linearGradient>
                    <linearGradient id="cG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/><stop offset="95%" stopColor="#f87171" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#475569",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} width={28}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Area type="monotone" dataKey="receita" stroke="#4ade80" strokeWidth={2} fill="url(#cR)" name="Receita"/>
                  <Area type="monotone" dataKey="gastos" stroke="#f87171" strokeWidth={2} fill="url(#cG)" name="Gastos"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{...card,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:10}}>🥧 Gastos por Categoria</div>
              {expensesByCategory.length===0?(
                <div style={{textAlign:"center",color:"#475569",padding:"16px 0",fontSize:12}}>Nenhum gasto registrado</div>
              ):(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={expensesByCategory} cx="50%" cy="50%" innerRadius={36} outerRadius={62} dataKey="value" stroke="none">
                        {expensesByCategory.map((e,i)=><Cell key={i} fill={e.color}/>)}
                      </Pie>
                      <Tooltip formatter={v=>formatCurrency(v)}/>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{width:"100%",display:"flex",flexDirection:"column",gap:6}}>
                    {expensesByCategory.map((c,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                        <span style={{color:"#94a3b8",flex:1,fontSize:12}}>{c.icon} {c.name}</span>
                        <span style={{color:"#e2e8f0",fontWeight:600,fontSize:12}}>{formatCurrency(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={card}>
              <div style={{fontSize:12,fontWeight:700,color:"#94a3b8",marginBottom:10}}>📈 Portfólio</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={investments.map(inv=>({name:inv.name,valor:inv.amount,retorno:inv.amount*inv.returnPct/100}))}>
                  <XAxis dataKey="name" tick={{fill:"#475569",fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:"#475569",fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} width={26}/>
                  <Tooltip content={<CustomTooltip/>}/>
                  <Bar dataKey="valor" fill="#a78bfa" radius={[5,5,0,0]} name="Investido"/>
                  <Bar dataKey="retorno" fill="#4ade80" radius={[5,5,0,0]} name="Retorno"/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* GASTOS */}
        {tab==="expenses"&&(
          <div>
            <div style={{marginBottom:20}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <div style={{fontSize:15,fontWeight:700,color:"#4ade80"}}>💚 Receitas</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setShowSetMonthlyIncome(true)} style={{...btnS,fontSize:11,padding:"7px 10px"}}>🔁 Mensal</button>
                  <button onClick={()=>setShowAddIncome(!showAddIncome)} style={{...btnG,fontSize:12,padding:"7px 12px"}}>+ Receita</button>
                </div>
              </div>
              {showAddIncome&&(
                <div style={{...card,marginBottom:12,borderColor:"#4ade8033"}}>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    <input placeholder="Descrição (ex: Freelance, Bônus...)" value={newIncome.description} onChange={e=>setNewIncome(p=>({...p,description:e.target.value}))} style={inp}/>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <input placeholder="Valor (R$)" type="number" value={newIncome.amount} onChange={e=>setNewIncome(p=>({...p,amount:e.target.value}))} style={inp}/>
                      <input type="date" value={newIncome.date} onChange={e=>setNewIncome(p=>({...p,date:e.target.value}))} style={inp}/>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={addIncomeTransaction} style={{...btnG,flex:1}}>Salvar</button>
                      <button onClick={()=>setShowAddIncome(false)} style={{...btnS,flex:1}}>Cancelar</button>
                    </div>
                  </div>
                </div>
              )}
              {monthlyIncomeConfig.enabled&&(
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"#0a1628",border:"1px solid #4ade8033",borderRadius:12,marginBottom:8}}>
                  <span style={{fontSize:18}}>🔁</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#f1f5f9"}}>{monthlyIncomeConfig.description} (recorrente)</div>
                    <div style={{fontSize:11,color:"#64748b"}}>Todo dia {monthlyIncomeConfig.dayOfMonth}</div>
                  </div>
                  <div style={{fontSize:14,fontWeight:800,color:"#4ade80"}}>{formatCurrency(parseFloat(monthlyIncomeConfig.amount)||0)}/mês</div>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {incomeTransactions.slice().reverse().map(rec=>(
                  <div key={rec.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#0a1f0f",border:"1px solid #4ade8022",borderRadius:14}}>
                    <div style={{width:38,height:38,borderRadius:12,background:"#4ade8022",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{rec.isMonthly?"🔁":"💚"}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600,color:"#f1f5f9",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{rec.description}</div>
                      <div style={{fontSize:11,color:"#475569"}}>{new Date(rec.date+"T00:00:00").toLocaleDateString("pt-BR")}</div>
                    </div>
                    <div style={{fontSize:14,fontWeight:800,color:"#4ade80",flexShrink:0}}>+{formatCurrency(rec.amount)}</div>
                    <button onClick={()=>setIncomeTransactions(prev=>prev.filter(r=>r.id!==rec.id))} style={{background:"none",border:"none",color:"#374151",cursor:"pointer",fontSize:18,padding:"4px 2px",flexShrink:0}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
            <div style={{height:1,background:"#1a2744",marginBottom:20}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:15,fontWeight:700,color:"#f87171"}}>💸 Despesas</div>
              <div style={{display:"flex",gap:8}}>
                <button onClick={()=>{setShowAddCategory(!showAddCategory);setShowAddExpense(false);}} style={{...btnS,fontSize:12,padding:"8px 12px"}}>+ Cat.</button>
                <button onClick={()=>{setShowAddExpense(!showAddExpense);setShowAddCategory(false);}} style={{...btnP,fontSize:12,padding:"8px 14px"}}>+ Gasto</button>
              </div>
            </div>
            {showAddExpense&&(
              <div style={{...card,marginBottom:14}}>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <input placeholder="Descrição" value={newExpense.description} onChange={e=>setNewExpense(p=>({...p,description:e.target.value}))} style={inp}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <input placeholder="Valor (R$)" type="number" value={newExpense.amount} onChange={e=>setNewExpense(p=>({...p,amount:e.target.value}))} style={inp}/>
                    <input type="date" value={newExpense.date} onChange={e=>setNewExpense(p=>({...p,date:e.target.value}))} style={inp}/>
                  </div>
                  <select value={newExpense.category} onChange={e=>setNewExpense(p=>({...p,category:e.target.value}))} style={inp}>
                    {categories.map(c=><option key={c.id} value={c.name}>{c.icon} {c.name}</option>)}
                  </select>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={addExpense} style={{...btnP,flex:1}}>Salvar</button>
                    <button onClick={()=>setShowAddExpense(false)} style={{...btnS,flex:1}}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}
            {showAddCategory&&(
              <div style={{...card,marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:"#94a3b8"}}>Nova Categoria</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <input placeholder="Nome" value={newCategory.name} onChange={e=>setNewCategory(p=>({...p,name:e.target.value}))} style={inp}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <input placeholder="Emoji" value={newCategory.icon} onChange={e=>setNewCategory(p=>({...p,icon:e.target.value}))} style={inp}/>
                    <div style={{display:"flex",alignItems:"center",gap:8,background:"#060d1a",border:"1px solid #1a2744",borderRadius:12,padding:"0 14px"}}>
                      <input type="color" value={newCategory.color} onChange={e=>setNewCategory(p=>({...p,color:e.target.value}))} style={{width:36,height:36,border:"none",background:"none",cursor:"pointer"}}/>
                      <span style={{color:"#64748b",fontSize:13}}>Cor</span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={addCategory} style={{...btnP,flex:1}}>Criar</button>
                    <button onClick={()=>setShowAddCategory(false)} style={{...btnS,flex:1}}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
              {categories.map(cat=>{
                const total=expenses.filter(e=>e.category===cat.name).reduce((s,e)=>s+e.amount,0);
                return(
                  <div key={cat.id} style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:20,border:`1px solid ${cat.color}44`,background:`${cat.color}11`}}>
                    <span style={{fontSize:12}}>{cat.icon}</span>
                    <span style={{fontSize:11,color:cat.color,fontWeight:600}}>{cat.name}</span>
                    {total>0&&<span style={{fontSize:10,color:"#64748b"}}>{formatCurrency(total)}</span>}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {expenses.slice().reverse().map(exp=>{
                const cat=categories.find(c=>c.name===exp.category)||{color:"#64748b",icon:"💰"};
                return(
                  <div key={exp.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#0d1b2a",border:"1px solid #1a2744",borderRadius:14}}>
                    <div style={{width:38,height:38,borderRadius:12,background:`${cat.color}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{cat.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600,color:"#f1f5f9",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{exp.description}</div>
                      <div style={{fontSize:11,color:"#475569"}}>{exp.category} • {new Date(exp.date+"T00:00:00").toLocaleDateString("pt-BR")}</div>
                    </div>
                    <div style={{fontSize:14,fontWeight:800,color:"#f87171",flexShrink:0}}>-{formatCurrency(exp.amount)}</div>
                    <button onClick={()=>setExpenses(prev=>prev.filter(e=>e.id!==exp.id))} style={{background:"none",border:"none",color:"#374151",cursor:"pointer",fontSize:18,padding:"4px 2px",flexShrink:0}}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* INVESTIMENTOS */}
        {tab==="investments"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:17,fontWeight:800,color:"#f1f5f9"}}>📈 Investimentos</div>
              <button onClick={()=>setShowAddInvestment(!showAddInvestment)} style={{...btnP,fontSize:12,padding:"8px 14px"}}>+ Ativo</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={card}><div style={{fontSize:10,color:"#64748b",marginBottom:4}}>TOTAL INVESTIDO</div><div style={{fontSize:16,fontWeight:800,color:"#a78bfa"}}>{formatCurrency(totalInvestments)}</div></div>
              <div style={card}><div style={{fontSize:10,color:"#64748b",marginBottom:4}}>RETORNO EST.</div><div style={{fontSize:16,fontWeight:800,color:"#4ade80"}}>{formatCurrency(investments.reduce((s,i)=>s+i.amount*i.returnPct/100,0))}</div></div>
              <div style={{...card,gridColumn:"1 / -1"}}><div style={{fontSize:10,color:"#64748b",marginBottom:4}}>PATRIMÔNIO TOTAL</div><div style={{fontSize:20,fontWeight:800,color:"#4fc3f7"}}>{formatCurrency(totalInvestments+investments.reduce((s,i)=>s+i.amount*i.returnPct/100,0))}</div></div>
            </div>
            {showAddInvestment&&(
              <div style={{...card,marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:"#94a3b8"}}>Adicionar Ativo</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <input placeholder="Nome (ex: PETR4)" value={newInvestment.name} onChange={e=>setNewInvestment(p=>({...p,name:e.target.value}))} style={inp}/>
                  <select value={newInvestment.type} onChange={e=>setNewInvestment(p=>({...p,type:e.target.value}))} style={inp}>{INVESTMENT_TYPES.map(t=><option key={t}>{t}</option>)}</select>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    <input placeholder="Valor (R$)" type="number" value={newInvestment.amount} onChange={e=>setNewInvestment(p=>({...p,amount:e.target.value}))} style={inp}/>
                    <input placeholder="Retorno (%)" type="number" value={newInvestment.returnPct} onChange={e=>setNewInvestment(p=>({...p,returnPct:e.target.value}))} style={inp}/>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={addInvestment} style={{...btnP,flex:1}}>Salvar</button>
                    <button onClick={()=>setShowAddInvestment(false)} style={{...btnS,flex:1}}>Cancelar</button>
                  </div>
                </div>
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {investments.map(inv=>{
                const rv=inv.amount*inv.returnPct/100;
                const tc={"Ações":"#f87171","FIIs":"#4fc3f7","Tesouro Direto":"#4ade80","CDB":"#fbbf24","Poupança":"#a78bfa","Criptomoedas":"#fb923c","ETFs":"#34d399","Outros":"#94a3b8"};
                const color=tc[inv.type]||"#94a3b8";
                return(
                  <div key={inv.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px",background:"#0d1b2a",border:"1px solid #1a2744",borderRadius:14}}>
                    <div style={{width:42,height:42,borderRadius:12,background:`${color}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:18}}>💎</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#f1f5f9"}}>{inv.name}</div>
                      <div style={{fontSize:11,color,fontWeight:600}}>{inv.type}</div>
                      <div style={{marginTop:6,height:4,background:"#1a2744",borderRadius:2,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min((inv.amount/totalInvestments)*100,100)}%`,background:color,borderRadius:2}}/>
                      </div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div style={{fontSize:14,fontWeight:800,color:"#e2e8f0"}}>{formatCurrency(inv.amount)}</div>
                      <div style={{fontSize:11,color:"#4ade80",fontWeight:600}}>+{inv.returnPct}%</div>
                      <div style={{fontSize:10,color:"#64748b"}}>{formatCurrency(rv)}</div>
                    </div>
                    <button onClick={()=>setInvestments(prev=>prev.filter(i=>i.id!==inv.id))} style={{background:"none",border:"none",color:"#374151",cursor:"pointer",fontSize:18,padding:"4px 2px"}}>✕</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RELATÓRIO */}
        {tab==="report"&&(
          <div>
            <div style={{fontSize:17,fontWeight:800,color:"#f1f5f9",marginBottom:16}}>📋 Relatório Mensal</div>
            <div style={{...card,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10,justifyContent:"center"}}>
                <button onClick={()=>{let m=reportMonth-1,y=reportYear;if(m<0){m=11;y--;}setReportMonth(m);setReportYear(y);}} style={{...btnS,padding:"8px 14px",fontSize:18}}>‹</button>
                <div style={{textAlign:"center",minWidth:160}}>
                  <div style={{fontSize:18,fontWeight:800,color:"#f1f5f9"}}>{MONTH_NAMES[reportMonth]}</div>
                  <div style={{fontSize:13,color:"#64748b"}}>{reportYear}</div>
                </div>
                <button onClick={()=>{let m=reportMonth+1,y=reportYear;if(m>11){m=0;y++;}setReportMonth(m);setReportYear(y);}} style={{...btnS,padding:"8px 14px",fontSize:18}}>›</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              <div style={{...card,borderColor:"#4ade8033"}}>
                <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>RECEITAS</div>
                <div style={{fontSize:isMobile?16:22,fontWeight:800,color:"#4ade80"}}>{formatCurrency(reportData.totalInc)}</div>
                <div style={{fontSize:10,color:"#475569",marginTop:2}}>{reportData.income.length} lançamento(s)</div>
              </div>
              <div style={{...card,borderColor:"#f8717133"}}>
                <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>GASTOS</div>
                <div style={{fontSize:isMobile?16:22,fontWeight:800,color:"#f87171"}}>{formatCurrency(reportData.totalExp)}</div>
                <div style={{fontSize:10,color:"#475569",marginTop:2}}>{reportData.expenses.length} lançamento(s)</div>
              </div>
              <div style={{...card,gridColumn:"1 / -1",borderColor:reportData.balance>=0?"#4fc3f733":"#f8717133"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>SALDO DO MÊS</div>
                    <div style={{fontSize:24,fontWeight:800,color:reportData.balance>=0?"#4fc3f7":"#f87171"}}>{formatCurrency(reportData.balance)}</div>
                  </div>
                  <div style={{fontSize:40}}>{reportData.balance>=0?"✅":"⚠️"}</div>
                </div>
                {reportData.totalInc>0&&(
                  <div style={{marginTop:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#64748b",marginBottom:4}}>
                      <span>Comprometimento da renda</span>
                      <span style={{color:reportData.totalExp/reportData.totalInc>0.7?"#f87171":"#4ade80"}}>{((reportData.totalExp/reportData.totalInc)*100).toFixed(0)}%</span>
                    </div>
                    <div style={{height:6,background:"#1a2744",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${Math.min((reportData.totalExp/reportData.totalInc)*100,100)}%`,background:reportData.totalExp/reportData.totalInc>0.7?"#f87171":reportData.totalExp/reportData.totalInc>0.5?"#fbbf24":"#4ade80",borderRadius:3,transition:"width 0.5s"}}/>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {reportData.byCategory.length>0&&(
              <div style={{...card,marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"#94a3b8",marginBottom:12}}>💸 Gastos por Categoria</div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {reportData.byCategory.map((cat,i)=>{
                    const pct = reportData.totalExp>0?((cat.value/reportData.totalExp)*100).toFixed(0):0;
                    return(
                      <div key={i}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                          <span style={{fontSize:13,color:"#e2e8f0"}}>{cat.icon} {cat.name}</span>
                          <div style={{textAlign:"right"}}>
                            <span style={{fontSize:13,fontWeight:700,color:cat.color}}>{formatCurrency(cat.value)}</span>
                            <span style={{fontSize:11,color:"#64748b",marginLeft:6}}>{pct}%</span>
                          </div>
                        </div>
                        <div style={{height:5,background:"#1a2744",borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:cat.color,borderRadius:3}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {reportData.income.length>0&&(
              <div style={{...card,marginBottom:14}}>
                <div style={{fontSize:13,fontWeight:700,color:"#4ade80",marginBottom:10}}>💚 Receitas do Mês</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {reportData.income.map((r,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:i<reportData.income.length-1?"1px solid #1a2744":"none"}}>
                      <div>
                        <div style={{fontSize:13,color:"#f1f5f9"}}>{r.description}</div>
                        <div style={{fontSize:11,color:"#475569"}}>{new Date(r.date+"T00:00:00").toLocaleDateString("pt-BR")}</div>
                      </div>
                      <span style={{fontSize:14,fontWeight:700,color:"#4ade80"}}>+{formatCurrency(r.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {reportData.expenses.length>0&&(
              <div style={card}>
                <div style={{fontSize:13,fontWeight:700,color:"#f87171",marginBottom:10}}>💸 Despesas do Mês</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {reportData.expenses.slice().sort((a,b)=>b.amount-a.amount).map((e,i)=>{
                    const cat=categories.find(c=>c.name===e.category)||{color:"#64748b",icon:"💰"};
                    return(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<reportData.expenses.length-1?"1px solid #1a2744":"none"}}>
                        <span style={{fontSize:14}}>{cat.icon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,color:"#f1f5f9",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.description}</div>
                          <div style={{fontSize:10,color:"#475569"}}>{e.category} • {new Date(e.date+"T00:00:00").toLocaleDateString("pt-BR")}</div>
                        </div>
                        <span style={{fontSize:13,fontWeight:700,color:"#f87171",flexShrink:0}}>-{formatCurrency(e.amount)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {reportData.expenses.length===0&&reportData.income.length===0&&(
              <div style={{...card,textAlign:"center",padding:40,color:"#475569"}}>
                <div style={{fontSize:32,marginBottom:12}}>📭</div>
                <div style={{fontSize:14}}>Nenhum lançamento em {MONTH_NAMES[reportMonth]}/{reportYear}</div>
              </div>
            )}
          </div>
        )}

        {/* CHAT */}
        {tab==="chat"&&(
          <div style={{display:"flex",flexDirection:"column",height:isMobile?"calc(100vh - 175px)":"calc(100vh - 200px)"}}>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:17,fontWeight:800,color:"#f1f5f9"}}>💬 Assistente</div>
              <div style={{fontSize:11,color:"#64748b"}}>Registre receitas e gastos como no WhatsApp</div>
            </div>
            <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingRight:2}}>
              {messages.map((msg,i)=>(
                <div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",alignItems:"flex-end",gap:8}}>
                  {msg.role==="ai"&&<div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#4fc3f7,#0288d1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>🤖</div>}
                  <div style={{maxWidth:"78%",padding:"10px 14px",borderRadius:msg.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px",background:msg.role==="user"?"linear-gradient(135deg,#0288d1,#0369a1)":"#0d1b2a",border:msg.role==="ai"?"1px solid #1a2744":"none",color:"#f1f5f9",fontSize:14,lineHeight:1.6,whiteSpace:"pre-wrap"}}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping&&(
                <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#4fc3f7,#0288d1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>🤖</div>
                  <div style={{padding:"10px 14px",borderRadius:"18px 18px 18px 4px",background:"#0d1b2a",border:"1px solid #1a2744"}}>
                    <span style={{display:"flex",gap:4}}>{[0,1,2].map(j=><span key={j} style={{width:6,height:6,borderRadius:"50%",background:"#4fc3f7",display:"inline-block",animation:`bounce 1s ${j*0.2}s infinite`}}/>)}</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef}/>
            </div>
            <div style={{display:"flex",gap:6,marginTop:10,marginBottom:8,flexWrap:"wrap"}}>
              {["Ganhei 500 de freela","Gastei 50 no almoço","Relatório do mês","Saldo?"].map(s=>(
                <button key={s} onClick={()=>setChatInput(s)} style={{padding:"6px 12px",borderRadius:20,border:"1px solid #1a2744",background:"#0d1b2a",color:"#64748b",fontSize:12,cursor:"pointer"}}>{s}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:8,paddingTop:10,borderTop:"1px solid #1a2744"}}>
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}
                placeholder="Ex: Ganhei 3000 de salário..." style={{...inp,borderRadius:24,padding:"12px 18px",flex:1}}/>
              <button onClick={sendMessage} disabled={!chatInput.trim()} style={{...btnP,borderRadius:"50%",width:46,height:46,padding:0,fontSize:18,flexShrink:0,opacity:chatInput.trim()?1:0.4}}>↑</button>
            </div>
          </div>
        )}
      </div>

      {/* MOBILE BOTTOM NAV */}
      {isMobile&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0d1b2a",borderTop:"1px solid #1a2744",display:"flex",zIndex:200,paddingBottom:"env(safe-area-inset-bottom)"}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);haptic('light');}} style={{flex:1,padding:"10px 2px 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <span style={{fontSize:18}}>{t.icon}</span>
              <span style={{fontSize:9,fontWeight:600,color:tab===t.id?"#4fc3f7":"#475569"}}>{t.label}</span>
              {tab===t.id&&<div style={{width:16,height:3,borderRadius:2,background:"#4fc3f7"}}/>}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:#1a2744;border-radius:2px}
        *{box-sizing:border-box} input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        select option{background:#0d1b2a}
        body { overscroll-behavior-y: contain; }
      `}</style>
    </div>
  );
}
