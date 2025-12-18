import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, Alert, StyleSheet, ScrollView, Platform, TouchableOpacity, Modal, KeyboardAvoidingView, TextInput as NativeInput, Linking } from 'react-native';
import { 
  Provider as PaperProvider, Button, TextInput, Title, Text, IconButton, 
  ActivityIndicator, Appbar, Avatar, Portal, DefaultTheme, Chip, Surface, Divider, Checkbox
} from 'react-native-paper';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { collection, addDoc, doc, updateDoc, where, setDoc, getDoc, orderBy, getDocs, onSnapshot, query, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebaseConfig';

// --- CONFIGURAÇÕES ---
const ADMIN_EMAIL = 'luccassts141@gmail.com'; 
const PIX_KEY = '56990991828';
const INSTAGRAM_URL = 'https://instagram.com/henglesbarbearia';

// Adicionais para o Combo (Ideia 1)
const EXTRAS_OPTIONS = [
  { name: 'Barba', price: 20 },
  { name: 'Sobrancelha', price: 10 },
  { name: 'Pezinho', price: 5 },
  { name: 'Hidratação', price: 25 },
];

// Horários Base
const BASE_HOURS = Array.from({length: 17}, (_, i) => {
  const h = i + 7; 
  return `${h < 10 ? '0'+h : h}:00`;
});

// --- HELPER DATA ---
const formatDateFriendly = (dateString: string) => {
  if(!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return `${dias[dateObj.getDay()]}, ${day}/${month}/${year}`;
};

const isAppointmentPast = (dateStr: string, timeStr: string) => {
  if(!dateStr || !timeStr) return false;
  const now = new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hr, min] = timeStr.split(':').map(Number);
  const apptDate = new Date(y, m - 1, d, hr, min);
  return now > apptDate;
};

const getPaymentIcon = (method: string) => {
  if (method && method.includes('Pix')) return 'qrcode';
  if (method && method.includes('Dinheiro')) return 'cash';
  return 'credit-card-outline';
};

// --- TEMA ---
const theme = {
  ...DefaultTheme,
  roundness: 8,
  colors: {
    ...DefaultTheme.colors,
    primary: '#D4AF37',
    accent: '#1A1A1A',
    background: '#000000',
    surface: '#121212',
    text: '#FFFFFF',
    placeholder: '#666',
  },
};

// --- INTERFACES ---
interface ServiceItem { id: string; title: string; price: string; description: string; date: string; availableSlots: string[]; }
interface Appointment { id: string; clientEmail: string; clientName: string; serviceTitle: string; date: string; time: string; status: 'pendente' | 'confirmado' | 'cancelado' | 'bloqueado'; paymentMethod: string; price: string; }
interface ChatMessage { id: string; text: string; sender: string; createdAt: any; }
interface Notice { id: string; title: string; message: string; createdAt: any; }
interface Review { id: string; clientName: string; rating: number; comment: string; createdAt: any; }
interface UserData { uid: string; name: string; email: string; createdAt: any; } // Para CRM

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color="#D4AF37" size="large" /></View>;

  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
            {!user ? <AuthScreen /> : user.email === ADMIN_EMAIL ? <AdminApp user={user} /> : <ClientApp user={user} />}
          </SafeAreaView>
        </KeyboardAvoidingView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

// ==========================================
// 1. LOGIN
// ==========================================
function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) return Alert.alert("Atenção", "Preencha email e senha.");
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if(!name) { setLoading(false); return Alert.alert("Atenção", "Digite seu nome para o cadastro."); }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, "users", cred.user.uid), { name, email, createdAt: new Date() });
      }
    } catch (e: any) {
      Alert.alert("Erro", "Verifique seus dados e tente novamente.");
    }
    setLoading(false);
  };

  return (
    <View style={styles.loginContainer}>
      <View style={{alignItems:'center', marginBottom:40}}>
        <Avatar.Icon size={120} icon="mustache" style={{backgroundColor: '#D4AF37', marginBottom: 20}} />
        <Title style={styles.goldTitle}>HENGLES BARBEARIA</Title>
      </View>
      <Surface style={styles.card}>
        {!isLogin && (
          <TextInput label="Seu Nome Completo" value={name} onChangeText={setName} mode="outlined" style={styles.input} textColor="white" theme={{colors:{background:'#1A1A1A'}}} activeOutlineColor="#D4AF37"/>
        )}
        <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" autoCapitalize="none" keyboardType="email-address" style={styles.input} textColor="white" theme={{colors:{background:'#1A1A1A'}}} activeOutlineColor="#D4AF37" />
        <TextInput label="Senha" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} mode="outlined" autoCapitalize="none" style={styles.input} textColor="white" theme={{colors:{background:'#1A1A1A'}}} activeOutlineColor="#D4AF37" right={<TextInput.Icon icon={showPassword?"eye-off":"eye"} onPress={()=>setShowPassword(!showPassword)} iconColor="#666"/>} />
        
        <Button mode="contained" onPress={handleAuth} loading={loading} style={styles.goldBtn} contentStyle={{height:55}}>
          {isLogin ? "ACESSAR SISTEMA" : "CRIAR CONTA"}
        </Button>
        <Button onPress={()=>setIsLogin(!isLogin)} textColor="#D4AF37" style={{marginTop:15}}>
          {isLogin ? "Não tem conta? Cadastre-se" : "Já tenho conta"}
        </Button>
      </Surface>
    </View>
  );
}

// ==========================================
// 2. CLIENTE APP
// ==========================================
function ClientApp({ user }: { user: any }) {
  const [tab, setTab] = useState<'home' | 'agenda'>('home');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [userName, setUserName] = useState('Cliente');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [bookingVisible, setBookingVisible] = useState(false);
  const [reviewsVisible, setReviewsVisible] = useState(false);

  useEffect(() => {
    const unsubSvc = onSnapshot(query(collection(db, "services")), s => {
      const activeServices = s.docs
        .map(d=>({id:d.id, ...d.data()} as ServiceItem))
        .filter(s => s.availableSlots && s.availableSlots.length > 0)
        .sort((a,b) => a.date > b.date ? 1 : -1);
      setServices(activeServices);
    });
    const unsubNotice = onSnapshot(query(collection(db, "notices"), orderBy('createdAt', 'desc')), s => {
      setNotices(s.docs.map(d=>({id:d.id, ...d.data()} as Notice)));
    });
    getDoc(doc(db, "users", user.uid)).then(s => { if(s.exists()) setUserName(s.data().name) });
    return () => { unsubSvc(); unsubNotice(); };
  }, []);

  return (
    <View style={{flex: 1, backgroundColor:'#000'}}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content title="Hengles Barbearia" titleStyle={styles.goldTitleSmall} />
        <Appbar.Action icon="instagram" iconColor="#D4AF37" onPress={() => Linking.openURL(INSTAGRAM_URL)} />
        <Appbar.Action icon="calendar-clock" iconColor={tab==='agenda'?'#D4AF37':'#666'} onPress={()=>setTab('agenda')} />
        <Appbar.Action icon="home" iconColor={tab==='home'?'#D4AF37':'#666'} onPress={()=>setTab('home')} />
        <Appbar.Action icon="logout" iconColor="red" onPress={()=>signOut(auth)} />
      </Appbar.Header>

      {tab === 'home' && (
        <ScrollView contentContainerStyle={{padding: 15}}>
          <View style={{marginBottom: 10, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
            <View>
              <Title style={{color:'white', fontSize:22}}>Olá, {userName}</Title>
              <Text style={{color:'#888'}}>Agende seu horário abaixo</Text>
            </View>
            <Button mode="outlined" onPress={()=>setReviewsVisible(true)} textColor="#D4AF37" style={{borderColor:'#D4AF37'}}>
              Avaliações
            </Button>
          </View>

          {notices.length > 0 && (
            <Surface style={{backgroundColor:'#222', padding:15, borderRadius:10, marginBottom:20, borderLeftWidth:4, borderLeftColor:'#D4AF37'}}>
              <Text style={{color:'#D4AF37', fontWeight:'bold', marginBottom:5}}>📢 AVISOS IMPORTANTES</Text>
              {notices.map(n => (
                <View key={n.id} style={{marginBottom:10}}>
                  <Text style={{color:'white', fontWeight:'bold'}}>{n.title}</Text>
                  <Text style={{color:'#CCC'}}>{n.message}</Text>
                </View>
              ))}
            </Surface>
          )}
          
          <Divider style={{backgroundColor:'#333', marginBottom:20}} />
          <Title style={{color:'#D4AF37', marginBottom:15, fontSize:18}}>Próximas Datas</Title>

          {services.length === 0 && <Text style={{color:'#666', fontStyle:'italic', textAlign:'center', marginTop:20}}>Nenhuma data disponível no momento.</Text>}

          {services.map(s => {
            const dateDisplay = formatDateFriendly(s.date);
            return (
              <TouchableOpacity key={s.id} onPress={()=>{setSelectedService(s); setBookingVisible(true)}} activeOpacity={0.9}>
                <Surface style={styles.serviceItem}>
                  <View style={{width:80, justifyContent:'center', alignItems:'center', backgroundColor:'#1A1A1A', borderRightWidth:1, borderRightColor:'#333'}}>
                      <Text style={{color:'#D4AF37', fontWeight:'bold', fontSize:22}}>{s.date.split('-')[2]}</Text>
                      <Text style={{color:'#666', fontSize:10, textTransform:'uppercase'}}>{dateDisplay.split(',')[0]}</Text>
                  </View>
                  <View style={{flex:1, padding:15, justifyContent:'center'}}>
                     <Title style={{color:'white', fontSize:16}}>{s.title}</Title>
                     {!!s.description && <Text style={{color:'#888', fontSize:12, marginBottom:5}} numberOfLines={2}>{s.description}</Text>}
                     <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:5}}>
                        <Text style={{color:'#D4AF37', fontWeight:'bold'}}>R$ {s.price}</Text>
                        <Chip style={{backgroundColor:'#333', height:24}} textStyle={{color:'white', fontSize:10, lineHeight:10}}>{s.availableSlots.length} Vagas</Chip>
                     </View>
                  </View>
                  <IconButton icon="chevron-right" iconColor="#D4AF37" />
                </Surface>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {tab === 'agenda' && <AgendaList userEmail={user.email} isAdmin={false} />}

      {selectedService && (
        <BookingModal visible={bookingVisible} onDismiss={()=>setBookingVisible(false)} service={selectedService} user={user} userName={userName} />
      )}
      <ReviewsModal visible={reviewsVisible} onDismiss={()=>setReviewsVisible(false)} user={user} userName={userName} />
    </View>
  );
}

// ==========================================
// 3. ADMIN APP (COM CRM E BLOQUEIO)
// ==========================================
function AdminApp({ user }: { user: any }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [financeModal, setFinanceModal] = useState(false);
  const [noticesModal, setNoticesModal] = useState(false);
  const [crmModal, setCrmModal] = useState(false); // Ideia 2: CRM
  const [blockModal, setBlockModal] = useState(false); // Ideia 3: Bloqueio

  return (
    <View style={{flex: 1, backgroundColor:'#000'}}>
      <Appbar.Header style={styles.header}>
        <Appbar.Content title="Painel Admin" titleStyle={styles.goldTitleSmall} />
        <Appbar.Action icon="lock-clock" iconColor="#D4AF37" onPress={()=>setBlockModal(true)} />
        <Appbar.Action icon="account-group" iconColor="#D4AF37" onPress={()=>setCrmModal(true)} />
        <Appbar.Action icon="bullhorn" iconColor="#D4AF37" onPress={()=>setNoticesModal(true)} />
        <Appbar.Action icon="currency-usd" iconColor="#D4AF37" onPress={()=>setFinanceModal(true)} />
        <Appbar.Action icon="logout" iconColor="red" onPress={()=>signOut(auth)} />
      </Appbar.Header>
      
      <AgendaList userEmail={user.email} isAdmin={true} />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Avatar.Icon icon="plus" size={60} style={{backgroundColor:'#D4AF37'}} color="black" />
      </TouchableOpacity>

      <AdminMasterModal visible={modalVisible} onDismiss={()=>setModalVisible(false)} />
      <AdminFinanceModal visible={financeModal} onDismiss={()=>setFinanceModal(false)} />
      <AdminNoticesModal visible={noticesModal} onDismiss={()=>setNoticesModal(false)} />
      <AdminCRMModal visible={crmModal} onDismiss={()=>setCrmModal(false)} />
      <AdminQuickBlockModal visible={blockModal} onDismiss={()=>setBlockModal(false)} />
    </View>
  );
}

// ==========================================
// 4. LISTA DE AGENDA
// ==========================================
function AgendaList({ userEmail, isAdmin }: { userEmail: string, isAdmin: boolean }) {
  const [fullList, setFullList] = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<'pendente' | 'realizado' | 'cancelado'>('pendente');

  useEffect(() => {
    let q = isAdmin 
      ? query(collection(db, "appointments")) 
      : query(collection(db, "appointments"), where("clientEmail", "==", userEmail));
    
    return onSnapshot(q, s => {
      let data = s.docs.map(d => ({id:d.id, ...d.data()} as Appointment));
      data.sort((a,b) => {
        if(a.date !== b.date) return a.date > b.date ? 1 : -1;
        return a.time > b.time ? 1 : -1;
      });
      setFullList(data);
    });
  }, [userEmail]);

  const handleCancel = (id:string) => {
    Alert.alert("Cancelar", "Confirmar cancelamento?", [
       {text:"Não"}, 
       {text:"Sim", onPress: async () => {
         await updateDoc(doc(db, "appointments", id), {status:'cancelado'});
         setSelected(null);
       }}
    ]);
  };

  const filteredList = fullList.filter(item => {
    // Bloqueados só aparecem para Admin na aba "Cancelado" ou "Realizado" dependendo da data?
    // Vamos deixar bloqueados escondidos do cliente, e visíveis pro admin como cinza
    if(item.status === 'bloqueado' && !isAdmin) return false;
    if(item.status === 'bloqueado' && isAdmin) return viewMode === 'pendente'; // Mostra bloqueio na agenda ativa do admin

    if (item.status === 'cancelado') return viewMode === 'cancelado';
    const isPast = isAppointmentPast(item.date, item.time);
    if (viewMode === 'realizado') return isPast;
    if (viewMode === 'pendente') return !isPast;
    return false;
  });

  return (
    <View style={{flex:1}}>
       <View style={{flexDirection:'row', backgroundColor:'#121212', padding:5}}>
         <Button mode={viewMode==='pendente'?'contained':'text'} onPress={()=>setViewMode('pendente')} style={{flex:1}} color="#D4AF37" labelStyle={{fontSize:10, fontWeight:'bold'}}>1. Pendente</Button>
         <Button mode={viewMode==='realizado'?'contained':'text'} onPress={()=>setViewMode('realizado')} style={{flex:1}} color="#D4AF37" labelStyle={{fontSize:10, fontWeight:'bold'}}>2. Realizado</Button>
         <Button mode={viewMode==='cancelado'?'contained':'text'} onPress={()=>setViewMode('cancelado')} style={{flex:1}} color="#D4AF37" labelStyle={{fontSize:10, fontWeight:'bold'}}>3. Cancelado</Button>
       </View>

       {filteredList.length === 0 && (
         <View style={{flex:1, justifyContent:'center', alignItems:'center'}}>
           <Text style={{color:'#666'}}>Vazio.</Text>
         </View>
       )}

       <FlatList 
         data={filteredList}
         keyExtractor={i=>i.id}
         contentContainerStyle={{padding:15, paddingBottom:80}}
         renderItem={({ item }) => (
           <TouchableOpacity onPress={()=>setSelected(item)} disabled={item.status === 'bloqueado'}>
             <Surface style={[styles.apptCard, {
               borderLeftColor: item.status === 'bloqueado' ? '#333' : (viewMode==='cancelado'?'red': (viewMode==='realizado'?'#666':'#D4AF37')),
               backgroundColor: item.status === 'bloqueado' ? '#222' : '#121212'
             }]}>
               <View style={{flexDirection:'row', alignItems:'center'}}>
                 <View style={{alignItems:'center', width:60, borderRightWidth:1, borderRightColor:'#333', marginRight:10}}>
                   <Text style={{color:viewMode==='cancelado'?'#666':'#D4AF37', fontWeight:'bold', fontSize:18}}>{item.time}</Text>
                   <Text style={{color:'#666', fontSize:10}}>{item.date.split('-').reverse().slice(0,2).join('/')}</Text>
                 </View>
                 <View style={{flex:1}}>
                   <Text style={{color: item.status==='bloqueado'?'#888':'white', fontWeight:'bold', fontSize:16, textDecorationLine: viewMode==='cancelado'?'line-through':'none'}}>
                     {item.status === 'bloqueado' ? 'HORÁRIO BLOQUEADO' : item.serviceTitle}
                   </Text>
                   <Text style={{color:'#AAA', fontSize:12}}>{isAdmin ? item.clientName : 'Hengles Barbearia'}</Text>
                   {viewMode === 'realizado' && <Chip style={{backgroundColor:'#222', height:20, marginTop:5, alignSelf:'flex-start'}} textStyle={{fontSize:9, lineHeight:9, color:'#888'}}>Concluído</Chip>}
                 </View>
                 {item.status !== 'bloqueado' && <IconButton icon="chevron-right" iconColor="#666" size={20}/>}
               </View>
             </Surface>
           </TouchableOpacity>
         )}
       />

       <Modal visible={!!selected} onRequestClose={()=>setSelected(null)} animationType="slide">
          <SafeAreaView style={{flex:1, backgroundColor:'#000'}}>
            <Appbar.Header style={{backgroundColor:'#1E1E1E'}}>
               <Appbar.BackAction onPress={()=>setSelected(null)} iconColor="white"/>
               <Appbar.Content title="Detalhes" titleStyle={{color:'#D4AF37'}}/>
               {selected?.status !== 'cancelado' && selected?.status !== 'bloqueado' && !isAppointmentPast(selected?.date || '', selected?.time || '') && (
                 <Appbar.Action icon="trash-can-outline" iconColor="#FF4444" onPress={()=>handleCancel(selected!.id)} />
               )}
            </Appbar.Header>

            <View style={{flex:1}}> 
               <ScrollView style={{maxHeight: 200}}>
                 <View style={{padding:20, backgroundColor:'#121212', margin:10, borderRadius:10}}>
                    <Text style={{color:'#D4AF37', fontSize:20, fontWeight:'bold', marginBottom:10}}>{selected?.serviceTitle}</Text>
                    <Text style={{color:'white'}}>Cliente: {selected?.clientName}</Text>
                    <Text style={{color:'white'}}>Data: {formatDateFriendly(selected?.date || '')} às {selected?.time}</Text>
                    <Text style={{color:'white'}}>Valor: R$ {selected?.price}</Text>
                    <Text style={{color:'white'}}>Pagamento: {selected?.paymentMethod}</Text>
                    <Text style={{color: selected?.status==='cancelado'?'red':(isAppointmentPast(selected?.date||'', selected?.time||'')?'#888':'#D4AF37'), marginTop:10, fontWeight:'bold'}}>
                        STATUS: {selected?.status === 'cancelado' ? 'CANCELADO' : (isAppointmentPast(selected?.date||'', selected?.time||'') ? 'REALIZADO' : 'PENDENTE')}
                    </Text>
                 </View>
               </ScrollView>

               <Title style={{color:'#D4AF37', marginLeft:20, fontSize:16}}>Chat</Title>
               <ChatComponent appointmentId={selected?.id} userEmail={userEmail} />
            </View>
          </SafeAreaView>
       </Modal>
    </View>
  );
}

// ==========================================
// NOVAS MODAIS: CRM & BLOQUEIO RÁPIDO
// ==========================================

// --- IDEIA 2: CRM (ADMIN) ---
function AdminCRMModal({ visible, onDismiss }: any) {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if(visible) fetchClients();
  }, [visible]);

  const fetchClients = async () => {
    setLoading(true);
    // 1. Pegar todos usuários
    const usersSnap = await getDocs(collection(db, "users"));
    const usersData = usersSnap.docs.map(d => ({id: d.id, ...d.data()} as UserData));
    
    // 2. Pegar todos agendamentos (para calcular gastos)
    const apptsSnap = await getDocs(query(collection(db, "appointments"), where("status", "==", "confirmado")));
    const appts = apptsSnap.docs.map(d => d.data());

    // 3. Cruzar dados
    const richClients = usersData.map(u => {
      // Filtra agendamentos deste usuario
      // Obs: idealmente 'appointments' teria userId, mas usamos clientEmail como link em algumas partes, 
      // mas no login salvamos 'users' com uid. No agendamento salvamos 'clientEmail'.
      // Vamos tentar linkar pelo email.
      const userAppts = appts.filter((a:any) => a.clientEmail === u.email);
      
      const totalSpent = userAppts.reduce((acc, curr) => {
        return acc + parseFloat(curr.price.replace(',','.'));
      }, 0);

      // Ultima visita
      const dates = userAppts.map((a:any) => a.date).sort();
      const lastVisit = dates.length > 0 ? dates[dates.length -1] : 'Nunca';

      return { ...u, totalSpent, lastVisit, visitCount: userAppts.length };
    });

    // Ordenar por quem gastou mais
    richClients.sort((a,b) => b.totalSpent - a.totalSpent);
    setClients(richClients);
    setLoading(false);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} animationType="slide">
        <SafeAreaView style={{flex:1, backgroundColor:'#000'}}>
          <Appbar.Header style={{backgroundColor:'#1E1E1E'}}>
            <Appbar.BackAction onPress={onDismiss} iconColor="white"/>
            <Appbar.Content title="CRM Clientes" titleStyle={{color:'#D4AF37'}}/>
          </Appbar.Header>
          {loading ? <ActivityIndicator color="#D4AF37" style={{marginTop:20}}/> : (
            <FlatList
              data={clients}
              keyExtractor={i => i.id}
              contentContainerStyle={{padding:15}}
              renderItem={({item}) => (
                <Surface style={{backgroundColor:'#121212', padding:15, borderRadius:10, marginBottom:10, borderLeftWidth:4, borderLeftColor: item.visitCount > 5 ? '#D4AF37' : '#333'}}>
                   <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                      <Text style={{color:'white', fontWeight:'bold', fontSize:16}}>{item.name}</Text>
                      <Text style={{color:'#D4AF37', fontWeight:'bold'}}>R$ {item.totalSpent.toFixed(2)}</Text>
                   </View>
                   <Text style={{color:'#888', fontSize:12}}>{item.email}</Text>
                   <View style={{flexDirection:'row', justifyContent:'space-between', marginTop:5}}>
                      <Chip textStyle={{fontSize:10, color:'white'}} style={{backgroundColor:'#333', height:24}}>Visitas: {item.visitCount}</Chip>
                      <Text style={{color:'#666', fontSize:12}}>Última: {item.lastVisit === 'Nunca' ? '-' : formatDateFriendly(item.lastVisit)}</Text>
                   </View>
                </Surface>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </Portal>
  );
}

// --- IDEIA 3: BLOQUEIO RÁPIDO (ADMIN) ---
function AdminQuickBlockModal({ visible, onDismiss }: any) {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  useEffect(() => {
    if(visible) {
       // Pega serviços futuros apenas
       const today = new Date().toISOString().split('T')[0];
       const q = query(collection(db, "services"), where("date", ">=", today));
       getDocs(q).then(s => {
         setServices(s.docs.map(d=>({id:d.id, ...d.data()} as ServiceItem)).sort((a,b)=>a.date>b.date?1:-1));
       });
    }
  }, [visible]);

  const blockSlot = async (slot: string) => {
    if(!selectedService) return;
    Alert.alert("Bloquear Horário", `Bloquear ${slot}? Ninguém poderá agendar.`, [
      {text:"Cancelar"},
      {text:"Bloquear", onPress: async () => {
         // 1. Remove do array de disponiveis
         const newSlots = selectedService.availableSlots.filter(s => s !== slot);
         await updateDoc(doc(db, "services", selectedService.id), { availableSlots: newSlots });
         
         // 2. Cria agendamento 'fake' de bloqueio para visualização na agenda
         await addDoc(collection(db, "appointments"), {
           clientEmail: 'admin@block', clientName: 'BLOQUEIO', serviceTitle: 'Horário Bloqueado', 
           date: selectedService.date, time: slot, status: 'bloqueado', price: '0', paymentMethod: '-', clientId: 'admin'
         });

         Alert.alert("Feito", "Horário bloqueado.");
         // Atualiza localmente
         setSelectedService({...selectedService, availableSlots: newSlots});
      }}
    ]);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} animationType="slide">
        <SafeAreaView style={{flex:1, backgroundColor:'#121212'}}>
           <Appbar.Header style={{backgroundColor:'#1E1E1E'}}>
             <Appbar.BackAction onPress={onDismiss} iconColor="white"/>
             <Appbar.Content title="Bloqueio Rápido" titleStyle={{color:'#D4AF37'}}/>
           </Appbar.Header>
           
           {!selectedService ? (
             <ScrollView contentContainerStyle={{padding:15}}>
               <Title style={{color:'white', marginBottom:10}}>Escolha o Dia:</Title>
               {services.map(s => (
                 <TouchableOpacity key={s.id} onPress={()=>setSelectedService(s)}>
                   <Surface style={{padding:15, backgroundColor:'#222', marginBottom:10, borderRadius:8}}>
                     <Text style={{color:'white', fontWeight:'bold'}}>{formatDateFriendly(s.date)}</Text>
                     <Text style={{color:'#888'}}>{s.availableSlots.length} horários livres</Text>
                   </Surface>
                 </TouchableOpacity>
               ))}
             </ScrollView>
           ) : (
             <View style={{padding:15}}>
               <Button icon="arrow-left" onPress={()=>setSelectedService(null)} textColor="#D4AF37" style={{alignSelf:'flex-start'}}>Voltar</Button>
               <Title style={{color:'white', textAlign:'center', marginVertical:10}}>{formatDateFriendly(selectedService.date)}</Title>
               <Text style={{color:'#666', textAlign:'center', marginBottom:20}}>Toque para bloquear:</Text>
               <View style={{flexDirection:'row', flexWrap:'wrap', justifyContent:'center'}}>
                 {selectedService.availableSlots.sort().map(slot => (
                   <TouchableOpacity key={slot} onPress={()=>blockSlot(slot)} style={{backgroundColor:'#333', padding:10, margin:5, borderRadius:8, minWidth:70, alignItems:'center'}}>
                     <Text style={{color:'white', fontWeight:'bold'}}>{slot}</Text>
                     <Avatar.Icon icon="lock" size={20} style={{backgroundColor:'transparent'}} color="#666"/>
                   </TouchableOpacity>
                 ))}
                 {selectedService.availableSlots.length === 0 && <Text style={{color:'#666'}}>Sem horários livres para bloquear.</Text>}
               </View>
             </View>
           )}
        </SafeAreaView>
      </Modal>
    </Portal>
  );
}

// ==========================================
// CLIENTE BOOKING (ATUALIZADO COM IDEIA 1: COMBOS)
// ==========================================
function BookingModal({ visible, onDismiss, service, user, userName }: any) {
  const [time, setTime] = useState('');
  const [payMethod, setPayMethod] = useState('Pix');
  const [step, setStep] = useState(1);
  // Ideia 1: Combos
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [finalPrice, setFinalPrice] = useState(service.price);

  useEffect(() => {
    // Recalcula preço
    let base = parseFloat(service.price.replace(',', '.'));
    let extrasTotal = 0;
    selectedExtras.forEach(eName => {
       const item = EXTRAS_OPTIONS.find(x => x.name === eName);
       if(item) extrasTotal += item.price;
    });
    setFinalPrice((base + extrasTotal).toFixed(2).replace('.',','));
  }, [selectedExtras]);

  const toggleExtra = (name: string) => {
     if(selectedExtras.includes(name)) setSelectedExtras(selectedExtras.filter(x=>x!==name));
     else setSelectedExtras([...selectedExtras, name]);
  };

  const confirm = async () => {
      const descExtras = selectedExtras.length > 0 ? ` (+ ${selectedExtras.join(', ')})` : '';
      await addDoc(collection(db, "appointments"), { 
        clientEmail: user.email, 
        clientName: userName, 
        serviceTitle: service.title + descExtras, 
        serviceDesc: (service.description || '') + descExtras, 
        price: finalPrice, 
        date: service.date, 
        time, 
        paymentMethod: payMethod, 
        status: 'confirmado', 
        clientId: user.uid 
      });
      
      const newSlots = service.availableSlots.filter((t:string) => t !== time);
      await updateDoc(doc(db, "services", service.id), { availableSlots: newSlots });
      Alert.alert("Sucesso!", "Agendado.");
      onDismiss();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} transparent animationType="fade">
         <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.9)', justifyContent:'center', padding:20}}>
            <Surface style={styles.card}>
               <Title style={{color:'#D4AF37', textAlign:'center', marginBottom:5}}>{service.title}</Title>
               <Text style={{color:'white', textAlign:'center', marginBottom:15}}>{formatDateFriendly(service.date)}</Text>
               
               {step === 1 ? (
                 <>
                   <Text style={{color:'#888', marginBottom:10, textAlign:'center'}}>1. Escolha Horário:</Text>
                   <View style={{flexDirection:'row', flexWrap:'wrap', justifyContent:'center', maxHeight: 200}}>
                      {service.availableSlots.sort().map((h: string) => (
                        <TouchableOpacity key={h} onPress={()=>setTime(h)} style={{padding:12, margin:4, backgroundColor:time===h?'#D4AF37':'#FFF', borderRadius:8, minWidth:60, alignItems:'center'}}><Text style={{color:'black', fontWeight:'bold'}}>{h}</Text></TouchableOpacity>
                      ))}
                   </View>
                   <Button mode="contained" disabled={!time} onPress={()=>setStep(2)} style={[styles.goldBtn, {marginTop:20}]}>PRÓXIMO</Button>
                 </>
               ) : step === 2 ? (
                  // IDEIA 1: TELA DE COMBOS
                 <>
                   <Text style={{color:'#D4AF37', marginBottom:10, textAlign:'center', fontWeight:'bold'}}>2. Turbine seu corte (Opcional):</Text>
                   <ScrollView style={{maxHeight: 250}}>
                     {EXTRAS_OPTIONS.map(opt => {
                       const isSel = selectedExtras.includes(opt.name);
                       return (
                         <TouchableOpacity key={opt.name} onPress={()=>toggleExtra(opt.name)} style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:15, backgroundColor: isSel ? '#333' : '#121212', marginBottom:5, borderRadius:8, borderWidth:1, borderColor: isSel ? '#D4AF37' : '#333'}}>
                            <Text style={{color:'white'}}>{opt.name}</Text>
                            <Text style={{color:'#D4AF37'}}>+ R$ {opt.price}</Text>
                         </TouchableOpacity>
                       )
                     })}
                   </ScrollView>
                   <Divider style={{marginVertical:10, backgroundColor:'#333'}}/>
                   <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:15}}>
                      <Text style={{color:'white', fontWeight:'bold'}}>TOTAL FINAL:</Text>
                      <Text style={{color:'#D4AF37', fontWeight:'bold', fontSize:18}}>R$ {finalPrice}</Text>
                   </View>
                   <Button mode="contained" onPress={()=>setStep(3)} style={styles.goldBtn}>IR PARA PAGAMENTO</Button>
                   <Button onPress={()=>setStep(1)} textColor="#666">Voltar</Button>
                 </>
               ) : (
                 <>
                   <Text style={{color:'white', marginBottom:10}}>3. Forma de Pagamento:</Text>
                   <View style={{flexDirection:'row', marginBottom:15, justifyContent:'center'}}>
                      {['Pix','Dinheiro'].map(p=>(<Chip key={p} selected={payMethod===p} onPress={()=>setPayMethod(p)} style={{marginRight:5, backgroundColor:payMethod===p?'#D4AF37':'#333'}}>{p}</Chip>))}
                   </View>
                   {payMethod==='Pix' && <View style={{padding:10, borderColor:'#D4AF37', borderWidth:1, borderRadius:5, alignItems:'center', marginBottom:10}}><Text style={{color:'#D4AF37', fontWeight:'bold'}}>CHAVE PIX</Text><Text style={{color:'white'}}>{PIX_KEY}</Text></View>}
                   <Button mode="contained" onPress={confirm} style={styles.goldBtn}>FINALIZAR AGENDAMENTO</Button>
                   <Button onPress={()=>setStep(2)} textColor="#666">Voltar</Button>
                 </>
               )}
               <Button onPress={onDismiss} textColor="#666" style={{marginTop:10}}>Cancelar</Button>
            </Surface>
         </View>
      </Modal>
    </Portal>
  );
}

// --- Outros Modais (Mantidos) ---
function ReviewsModal({ visible, onDismiss, user, userName }: any) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  
  useEffect(() => {
    if(visible) {
       const q = query(collection(db, "reviews"), orderBy('createdAt', 'desc'));
       onSnapshot(q, s => setReviews(s.docs.map(d=>({id:d.id, ...d.data()} as Review))));
    }
  }, [visible]);

  const sendReview = async () => {
     if(!comment) return Alert.alert("Ops", "Escreva um comentário.");
     await addDoc(collection(db, "reviews"), { clientName: userName, rating, comment, createdAt: new Date() });
     setComment('');
     Alert.alert("Obrigado!", "Avaliação enviada.");
  };

  const getStars = (r: number) => {
    return Array.from({length: 5}, (_, i) => (
       <Text key={i} style={{color: i < r ? '#D4AF37' : '#333', fontSize:16}}>★</Text>
    ));
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} animationType="slide">
        <SafeAreaView style={{flex:1, backgroundColor:'#000'}}>
           <Appbar.Header style={{backgroundColor:'#1E1E1E'}}>
             <Appbar.BackAction onPress={onDismiss} iconColor="white"/>
             <Appbar.Content title="Avaliações" titleStyle={{color:'#D4AF37'}}/>
           </Appbar.Header>
           <View style={{padding:15}}>
              <Surface style={{padding:15, backgroundColor:'#121212', borderRadius:10, marginBottom:20}}>
                 <Text style={{color:'white', textAlign:'center', marginBottom:10}}>Deixe sua nota:</Text>
                 <View style={{flexDirection:'row', justifyContent:'center', marginBottom:15}}>
                    {[1,2,3,4,5].map(n => (
                       <TouchableOpacity key={n} onPress={()=>setRating(n)}><Text style={{fontSize:30, color: n <= rating ? '#D4AF37' : '#333', marginHorizontal:5}}>★</Text></TouchableOpacity>
                    ))}
                 </View>
                 <TextInput label="Comentário" value={comment} onChangeText={setComment} mode="outlined" style={styles.input} textColor="white" theme={{colors:{background:'#252525'}}}/>
                 <Button mode="contained" onPress={sendReview} style={styles.goldBtn}>ENVIAR</Button>
              </Surface>
              <FlatList 
                data={reviews}
                keyExtractor={i=>i.id}
                renderItem={({item}) => (
                   <View style={{marginBottom:15, borderBottomWidth:1, borderBottomColor:'#222', paddingBottom:10}}>
                      <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                         <Text style={{color:'#D4AF37', fontWeight:'bold'}}>{item.clientName}</Text>
                         <View style={{flexDirection:'row'}}>{getStars(item.rating)}</View>
                      </View>
                      <Text style={{color:'#CCC', marginTop:5}}>{item.comment}</Text>
                   </View>
                )}
              />
           </View>
        </SafeAreaView>
      </Modal>
    </Portal>
  );
}

function AdminNoticesModal({ visible, onDismiss }: any) {
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');

  const postNotice = async () => {
    if(!title || !msg) return;
    await addDoc(collection(db, "notices"), { title, message: msg, createdAt: new Date() });
    setTitle(''); setMsg('');
    Alert.alert("Sucesso", "Aviso postado!");
    onDismiss();
  };

  const clearNotices = async () => {
    const q = query(collection(db, "notices"));
    const s = await getDocs(q);
    s.forEach(async d => await deleteDoc(doc(db, "notices", d.id)));
    Alert.alert("Limpo", "Mural limpo.");
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} transparent animationType="fade">
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.8)', justifyContent:'center', padding:20}}>
           <Surface style={styles.card}>
              <Title style={{color:'#D4AF37', marginBottom:15}}>Novo Aviso</Title>
              <TextInput label="Título (ex: Promoção)" value={title} onChangeText={setTitle} mode="outlined" style={styles.input} textColor="white" theme={{colors:{background:'#252525'}}}/>
              <TextInput label="Mensagem" value={msg} onChangeText={setMsg} mode="outlined" multiline numberOfLines={3} style={styles.input} textColor="white" theme={{colors:{background:'#252525'}}}/>
              <Button mode="contained" onPress={postNotice} style={styles.goldBtn}>POSTAR NO MURAL</Button>
              <Button onPress={clearNotices} textColor="red" style={{marginTop:10}}>Limpar Mural</Button>
              <Button onPress={onDismiss} textColor="#666">Fechar</Button>
           </Surface>
        </View>
      </Modal>
    </Portal>
  );
}

function ChatComponent({ appointmentId, userEmail }: { appointmentId?: string, userEmail: string }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [txt, setTxt] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if(!appointmentId) return;
    const q = query(collection(db, `appointments/${appointmentId}/messages`), orderBy('createdAt','asc'));
    return onSnapshot(q, s => {
      setMsgs(s.docs.map(d=>({id:d.id, ...d.data()} as ChatMessage)));
      setTimeout(() => flatListRef.current?.scrollToEnd({animated:true}), 200);
    });
  }, [appointmentId]);

  const send = async () => {
    if(!txt.trim() || !appointmentId) return;
    const textToSend = txt;
    setTxt(''); 
    await addDoc(collection(db, `appointments/${appointmentId}/messages`), { text: textToSend, sender:userEmail, createdAt:new Date() });
  };

  return (
    <View style={{flex:1, borderTopWidth:1, borderTopColor:'#222'}}>
      <FlatList 
        ref={flatListRef}
        data={msgs} 
        keyExtractor={m=>m.id} 
        contentContainerStyle={{padding:15}}
        renderItem={({item})=>(
          <View style={{
            alignSelf: item.sender===userEmail?'flex-end':'flex-start', 
            backgroundColor: item.sender===userEmail?'#D4AF37':'#222', 
            padding:12, borderRadius:15, marginBottom:5, maxWidth:'80%',
            borderTopRightRadius: item.sender===userEmail?0:15,
            borderTopLeftRadius: item.sender===userEmail?15:0
          }}>
            <Text style={{color: item.sender===userEmail?'black':'white', fontSize:15}}>{item.text}</Text>
          </View>
        )} 
      />
      <View style={{flexDirection:'row', padding:10, backgroundColor:'#121212', alignItems:'center'}}>
        <NativeInput value={txt} onChangeText={setTxt} placeholder="Mensagem..." placeholderTextColor="#666" style={{flex:1, backgroundColor:'#252525', borderRadius:25, height:50, paddingHorizontal:20, color:'white', fontSize: 16}} />
        <IconButton icon="send" iconColor="#D4AF37" size={30} onPress={send} style={{marginLeft: 5}} />
      </View>
    </View>
  );
}

function AdminFinanceModal({ visible, onDismiss }: any) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ today: 0, month: 0, countToday: 0 });

  useEffect(() => { if(visible) loadStats(); }, [visible]);

  const loadStats = async () => {
    setLoading(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonth = todayStr.substring(0, 7);
    const q = query(collection(db, "appointments"), where("status", "==", "confirmado")); 
    const snap = await getDocs(q); 
    
    let tTotal = 0, mTotal = 0, tCount = 0;
    snap.docs.forEach(d => {
      const data = d.data();
      const isPast = isAppointmentPast(data.date, data.time);
      if (isPast) {
          const price = parseFloat(data.price.replace(',', '.'));
          if (data.date.startsWith(currentMonth)) mTotal += price;
          if (data.date === todayStr) { tTotal += price; tCount++; }
      }
    });
    setStats({ today: tTotal, month: mTotal, countToday: tCount });
    setLoading(false);
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} animationType="fade">
        <View style={{flex:1, backgroundColor:'rgba(0,0,0,0.8)', justifyContent:'center', padding:20}}>
           <Surface style={styles.card}>
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
                 <Title style={{color:'#D4AF37'}}>Fluxo de Caixa (Realizados)</Title>
                 <IconButton icon="close" iconColor="white" onPress={onDismiss}/>
              </View>
              {loading ? <ActivityIndicator color="#D4AF37" /> : (
                <>
                  <View style={{backgroundColor:'#222', padding:15, borderRadius:10, marginBottom:10}}>
                      <Text style={{color:'#888', fontSize:12}}>HOJE</Text>
                      <Text style={{color:'white', fontSize:32, fontWeight:'bold'}}>R$ {stats.today.toFixed(2).replace('.', ',')}</Text>
                      <Text style={{color:'#D4AF37', marginTop:5}}>{stats.countToday} cortes</Text>
                  </View>
                  <View style={{backgroundColor:'#222', padding:15, borderRadius:10}}>
                      <Text style={{color:'#888', fontSize:12}}>ESTE MÊS</Text>
                      <Text style={{color:'white', fontSize:32, fontWeight:'bold'}}>R$ {stats.month.toFixed(2).replace('.', ',')}</Text>
                  </View>
                </>
              )}
           </Surface>
        </View>
      </Modal>
    </Portal>
  );
}

function AdminMasterModal({ visible, onDismiss }: any) {
  const [mode, setMode] = useState<'booking' | 'service'>('booking');
  const [clientName, setClientName] = useState('');
  const [time, setTime] = useState('');
  const [svcNameManual, setSvcNameManual] = useState('');
  const [svcPriceManual, setSvcPriceManual] = useState('');
  const [manualPay, setManualPay] = useState('Dinheiro'); 
  const [svcName, setSvcName] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDate, setSvcDate] = useState(''); 
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  const AdvancedCalendar = ({ onSelect }: any) => {
    const [viewDate, setViewDate] = useState(new Date());
    const days = Array.from({length: new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()}, (_, i) => i + 1);
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return (
      <View style={{backgroundColor:'#222', padding:10, borderRadius:10}}>
        <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
           <IconButton icon="chevron-left" iconColor="#D4AF37" onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} />
           <Text style={{color:'white', fontWeight:'bold'}}>{monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}</Text>
           <IconButton icon="chevron-right" iconColor="#D4AF37" onPress={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} />
        </View>
        <View style={{flexDirection:'row', flexWrap:'wrap', justifyContent:'center'}}>
           {days.map(d => {
             const dateStr = `${viewDate.getFullYear()}-${(viewDate.getMonth()+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
             return (
               <TouchableOpacity key={d} onPress={() => onSelect(dateStr)} style={{width: 35, height: 35, margin: 3, borderRadius: 17, backgroundColor: svcDate === dateStr ? '#D4AF37' : '#333', justifyContent: 'center', alignItems: 'center'}}>
                 <Text style={{color: svcDate === dateStr ? 'black' : 'white', fontSize:12}}>{d}</Text>
               </TouchableOpacity>
             )
           })}
        </View>
      </View>
    );
  };

  const toggleSlot = (t:string) => {
    if(selectedSlots.includes(t)) setSelectedSlots(selectedSlots.filter(x=>x!==t));
    else setSelectedSlots([...selectedSlots, t].sort());
  };

  const confirmBooking = async () => {
    if(!clientName || !svcNameManual || !svcPriceManual) return Alert.alert("Ops", "Preencha tudo");
    const today = new Date().toISOString().split('T')[0]; 
    await addDoc(collection(db, "appointments"), { clientEmail: 'admin@manual.com', clientName, serviceTitle: svcNameManual, serviceDesc: 'Agendamento Manual', price: svcPriceManual, date: today, time: time || 'Manual', status: 'confirmado', paymentMethod: manualPay, clientId: 'admin' });
    Alert.alert("Sucesso", "Agendamento criado!");
    onDismiss();
  };

  const confirmService = async () => {
    if(!svcName || !svcPrice || !svcDate || selectedSlots.length === 0) return Alert.alert("Ops", "Preencha tudo");
    await addDoc(collection(db, "services"), { title: svcName, price: svcPrice, description: svcDesc, date: svcDate, availableSlots: [...new Set(selectedSlots)].sort() });
    Alert.alert("Sucesso", "Oferta criada!");
    onDismiss();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} animationType="slide">
        <SafeAreaView style={{flex:1, backgroundColor:'#121212'}}>
           <Appbar.Header style={{backgroundColor:'#1E1E1E'}}>
             <Appbar.BackAction onPress={onDismiss} iconColor="white"/>
             <Appbar.Content title="Menu Admin" titleStyle={{color:'#D4AF37'}}/>
           </Appbar.Header>
           <View style={{flexDirection:'row', padding:10}}>
             <Button mode={mode==='booking'?'contained':'text'} onPress={()=>setMode('booking')} color="#D4AF37" style={{flex:1, marginRight:2}}>Manual</Button>
             <Button mode={mode==='service'?'contained':'text'} onPress={()=>setMode('service')} color="#D4AF37" style={{flex:1}}>Oferta</Button>
           </View>
           <ScrollView contentContainerStyle={{padding:20}}>
             {mode === 'booking' && (
               <>
                 <Title style={{color:'white', marginBottom:15}}>Agendamento Manual</Title>
                 <TextInput label="Cliente" value={clientName} onChangeText={setClientName} mode="outlined" style={styles.input} textColor="white" theme={{colors:{background:'#252525'}}}/>
                 <TextInput label="Serviço" value={svcNameManual} onChangeText={setSvcNameManual} mode="outlined" style={styles.input} textColor="white" theme={{colors:{background:'#252525'}}}/>
                 <TextInput label="Valor (R$)" value={svcPriceManual} onChangeText={setSvcPriceManual} keyboardType="numeric" mode="outlined" style={styles.input} textColor="white" theme={{colors:{background:'#252525'}}}/>
                 <TextInput label="Horário (ex: 14:00)" value={time} onChangeText={setTime} mode="outlined" style={styles.input} textColor="white" theme={{colors:{background:'#252525'}}}/>
                 <Button mode="contained" onPress={confirmBooking} style={[styles.goldBtn, {marginTop:20}]}>CONFIRMAR</Button>
               </>
             )}
             {mode === 'service' && (
               <>
                 <Title style={{color:'white', marginBottom:5}}>Criar Serviço</Title>
                 <TextInput label="Nome" value={svcName} onChangeText={setSvcName} mode="outlined" style={styles.input} textColor="white" theme={{colors:{background:'#252525'}}}/>
                 <TextInput label="Valor" value={svcPrice} onChangeText={setSvcPrice} keyboardType="numeric" mode="outlined" style={styles.input} textColor="white" theme={{colors:{background:'#252525'}}}/>
                 <AdvancedCalendar onSelect={setSvcDate} />
                 {svcDate ? <View style={{flexDirection:'row', flexWrap:'wrap', justifyContent:'center', marginTop:10}}>{BASE_HOURS.map(h => (<TouchableOpacity key={h} onPress={()=>toggleSlot(h)} style={{padding:8, margin:4, backgroundColor:selectedSlots.includes(h)?'#D4AF37':'#333', borderRadius:6}}><Text style={{color:selectedSlots.includes(h)?'black':'white'}}>{h}</Text></TouchableOpacity>))}</View> : null}
                 <Button mode="contained" onPress={confirmService} style={[styles.goldBtn, {marginTop:20}]}>PUBLICAR</Button>
               </>
             )}
           </ScrollView>
        </SafeAreaView>
      </Modal>
    </Portal>
  );
}

// --- ESTILOS ---
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loginContainer: { flex: 1, padding: 30, justifyContent: 'center', backgroundColor:'#000' },
  goldTitle: { fontSize: 26, fontWeight: 'bold', color: '#D4AF37' },
  goldTitleSmall: { fontWeight: 'bold', color: '#D4AF37' },
  card: { padding: 20, borderRadius: 15, backgroundColor: '#121212', elevation: 4 },
  input: { marginBottom: 10, backgroundColor: '#252525' },
  goldBtn: { backgroundColor: '#D4AF37', borderRadius: 8 },
  header: { backgroundColor: '#121212', elevation:0, borderBottomWidth:1, borderBottomColor:'#222' },
  serviceItem: { flexDirection:'row', backgroundColor:'#121212', marginBottom:15, borderRadius:10, overflow:'hidden', elevation:3, borderBottomWidth:1, borderBottomColor:'#222' },
  apptCard: { padding:15, borderRadius:10, backgroundColor:'#121212', marginBottom:10, borderLeftWidth:4, elevation:2 },
  fab: { position: 'absolute', margin: 16, right: 0, bottom: 0, elevation: 8 },
});