'use client';

import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const FORBIDDEN_WORDS = ['사단', '여단', '연대', '대대', '중대', '소대', '분대', '군단', '사령부', '제0부대', '제1부대', '제2부대', '제3부대', '제4부대', '제5부대', '제6부대', '제7부대', '제8부대', '제9부대', '부대번호', '통상명칭', '기지', '영내', '영외', '주둔지', '비행단', '전투비행단', '전비', '0비', '1비', '2비', '3비', '4비', '5비', '6비', '7비', '8비', '9비', '포대', '사이트', '관제대', '전대', '전방', 'GOP', 'GP', '페바', 'FEBA', '예비사단', '신교대', '훈련소', '함대', '전단', '고속정대', '함정', '0함대', '도서부대', '연평부대', '백령부대', '훈련', '작전', '검열', '검열관', '비상소집', '등화관제', '불시훈련', '대침투', '전술훈련', '기동훈련', '합동훈련', '호국훈련', '화랑훈련', '충무훈련', '재난대비', '유격', '혹한기', '동계훈련', '전술행군', '행군', '과학화전투훈련', 'KCTC', 'ATT', 'BCT', 'RCT', 'ORE', 'ORI', '소태', '활주로', '피해복구', '야간비행', '대공방어', 'ATS', '해상기동훈련', '사격훈련', '함포사격', '항해', '출항', '입항', '수로조사', '전투기', '헬기', '전차', '장갑차', '미사일', '패트리어트', '천궁', '탄약고', '무기고', '장비결함', '가동률', '당직사령', '당직사관', '통제실', '지통실', '지휘통제실', '탄약관리', '위병소', '초소', '근무스케줄', '상황발생', '5분대기조', '5대기', 'UFS', '을지', '자유의방패', 'FS', '연합훈련', '독수리훈련', '키리졸브', '을지연습'];
const checkForbidden = (text) => {
  if (!text) return null;
  const found = FORBIDDEN_WORDS.find(w => text.includes(w));
  return found ? found : null;
};

const LEAVE_TYPES = {
  annual:  { label:"연가",       icon:"🌿", color:"#05C072", bg:"#E8FBF3", border:"#B7F0D5" },
  reward:  { label:"포상휴가",   icon:"🏅", color:"#3182F6", bg:"#EBF3FF", border:"#A5C9FF" },
  comfort: { label:"위로휴가",   icon:"💜", color:"#7C3AED", bg:"#F3EEFF", border:"#C9B2F8" },
  perf:    { label:"외박", icon:"⭐", color:"#FF6B00", bg:"#FFF2E8", border:"#FFD0A8" },
  outing:  { label:"외출",       icon:"🚶", color:"#FF6B6B", bg:"#FFF0F0", border:"#FFB8B8" },
};
const EVENT_TYPES = {
  visit_in:    { label:"영내면회", icon:"🏠", color:"#3182F6", bg:"#EBF3FF", border:"#A5C9FF" },
  visit_out:   { label:"면회외출", icon:"🚗", color:"#7C3AED", bg:"#F3EEFF", border:"#C9B2F8" },
  weekend_out: { label:"주말외출", icon:"☀️", color:"#FF9500", bg:"#FFF8E8", border:"#FFDB9A" },
};
const HOLIDAYS = {
  "2026-01-01":"신정","2026-01-28":"설날연휴","2026-01-29":"설날","2026-01-30":"설날연휴",
  "2026-03-01":"삼일절","2026-05-05":"어린이날","2026-05-25":"부처님오신날",
  "2026-06-06":"현충일","2026-07-17":"제헌절","2026-08-15":"광복절","2026-08-17":"광복절(대체)",
  "2026-09-24":"추석연휴","2026-09-25":"추석","2026-09-26":"추석연휴",
  "2026-10-03":"개천절","2026-10-09":"한글날","2026-12-25":"크리스마스",
  "2027-01-01":"신정","2027-02-07":"설날","2027-03-01":"삼일절",
  "2027-05-05":"어린이날","2027-06-06":"현충일","2027-07-17":"제헌절",
  "2027-08-15":"광복절","2027-10-03":"개천절","2027-10-09":"한글날","2027-12-25":"크리스마스",
};
const DAY_LABELS = ["일","월","화","수","목","금","토"];
const RANK_LABELS = ["이등병","일병","상병","병장"];
const BASE_DUR = { 이등병:2, 일병:6, 상병:6 };

async function signInWithKakao() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        // 이메일을 제외하고 프로필 정보만 명시적으로 요청
        scope: 'profile_nickname profile_image',
      },
    },
  });
  if (error) console.error('카카오 로그인 오류:', error);
}

function calcRankSchedule(enlist, missedMonths) {
  const ed = new Date(enlist);
  const dur = {};
  RANK_LABELS.slice(0,-1).forEach(r => {
    dur[r] = BASE_DUR[r] + (missedMonths?.[r] || 0);
  });
  const base = new Date(ed.getFullYear(), ed.getMonth() + 1, 1);
  const addMonth = (d, n) => { const r = new Date(d); r.setMonth(r.getMonth()+n); return r; };
  const promotions = {};
  let cursor = base;
  RANK_LABELS.slice(0,-1).forEach(r => {
    cursor = addMonth(cursor, dur[r]);
    promotions[r] = toKey(cursor);
  });
  return { dur, promotions };
}

function calcRankInfo(enlist, missedMonths, targetDate) {
  const td = targetDate ? new Date(targetDate) : new Date();
  const { promotions } = calcRankSchedule(enlist, missedMonths);
  const tdKey = toKey(td);
  let currentRank = "이등병";
  if (tdKey >= promotions["상병"]) currentRank = "병장";
  else if (tdKey >= promotions["일병"]) currentRank = "상병";
  else if (tdKey >= promotions["이등병"]) currentRank = "일병";
  const ed = new Date(enlist);
  const rankStartKey = currentRank === "이등병"
    ? toKey(new Date(ed.getFullYear(), ed.getMonth() + 1, 1))
    : promotions[RANK_LABELS[RANK_LABELS.indexOf(currentRank)-1]];
  const rankStartD = new Date(rankStartKey);
  const hobon = (td.getFullYear()-rankStartD.getFullYear())*12+(td.getMonth()-rankStartD.getMonth())+1;
  const nextRankKey = RANK_LABELS.indexOf(currentRank) < 3 ? promotions[currentRank] : null;
  return { currentRank, hobon, promotions, nextRankKey };
}


const fmtWon = (n) => n ? n.toLocaleString() + "원" : "0원";
const fmtMan = (n) => {
  if (!n) return "0원";
  if (n >= 10000) {
    const man = Math.floor(n / 10000);
    const rest = n % 10000;
    return rest > 0 ? `${man}만 ${rest.toLocaleString()}원` : `${man}만원`;
  }
  return n.toLocaleString() + "원";
};

const toKey = (d) => {
  const dt = typeof d==="string"?new Date(d):d;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
};
const addDays = (s,n) => { const d=new Date(s); d.setDate(d.getDate()+n); return toKey(d); };
const diffDays = (a,b) => Math.round((new Date(b)-new Date(a))/86400000);
const isRedDay = (k) => !!HOLIDAYS[k]||new Date(k).getDay()===0;
const isSat = (k) => new Date(k).getDay()===6;
const isOffDay = (k) => !!HOLIDAYS[k] || new Date(k).getDay()===0 || new Date(k).getDay()===6;
const fmtDate = (k) => k?k.replace(/-/g,"."):"";

const calcOutingDates = (firstStart,cycleWeeks,cycleDays) => {
  if(!firstStart||!cycleWeeks||!cycleDays) return [];
  const res=[]; let start=firstStart;
  for(let i=0;i<30;i++){
    const end=addDays(start,cycleDays-1);
    res.push({idx:i,start,end,days:cycleDays});
    start=addDays(end,cycleWeeks*7-cycleDays+1);
    if(start>"2030-01-01") break;
  }
  return res;
};

const SOLDIER_PAY = { 이등병:750000, 일병:900000, 상병:1200000, 병장:1500000 };
const NAEILJUN_MAX = 550000;

const S = {
  wrap:{ maxWidth:390,margin:"0 auto",minHeight:"100vh",background:"#fff",fontFamily:"'Apple SD Gothic Neo','Noto Sans KR',sans-serif",display:"flex",flexDirection:"column",position:"relative" },
  header:{ position:"sticky",top:0,zIndex:40,background:"rgba(255,255,255,.96)",backdropFilter:"blur(12px)",borderBottom:"1px solid #F2F4F6",padding:"0 20px",height:56,display:"flex",alignItems:"center",justifyContent:"space-between" },
  content:{ flex:1,overflowY:"auto",paddingBottom:76 },
  tabBar:{ position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:390,height:60,background:"rgba(255,255,255,.97)",backdropFilter:"blur(20px)",borderTop:"1px solid #F2F4F6",display:"flex",boxShadow:"0 -2px 16px rgba(0,0,0,.06)",zIndex:50 },
  card:{ background:"#fff",borderRadius:16,padding:"16px 18px",boxShadow:"0 1px 6px rgba(0,0,0,.06)" },
  btn:{ width:"100%",padding:15,borderRadius:14,fontSize:16,fontWeight:700,border:"none",cursor:"pointer" },
  input:{ width:"100%",background:"#F9FAFB",border:"1.5px solid #E8ECF0",borderRadius:12,padding:"13px 15px",fontSize:15,fontWeight:500,color:"#191F28",outline:"none" },
  chip:{ padding:"6px 13px",borderRadius:100,fontSize:13,fontWeight:600,border:"1.5px solid #E8ECF0",color:"#4E5968",background:"#fff",cursor:"pointer" },
  overlay:{ position:"fixed",inset:0,background:"rgba(25,31,40,.42)",backdropFilter:"blur(3px)",zIndex:80,display:"flex",alignItems:"flex-end",justifyContent:"center" },
  sheet:{ background:"#fff",borderRadius:"22px 22px 0 0",width:"100%",maxWidth:390,padding:"0 20px 40px",maxHeight:"88vh",overflowY:"auto" },
  handle:{ width:40,height:4,background:"#E8ECF0",borderRadius:2,margin:"12px auto 20px" },
  sectionTitle:{ fontSize:11,fontWeight:700,color:"#8B95A1",letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:10 },
};

function WarnModal({ msg, onClose }) {
  return (
    <div className="fi" style={{position:"fixed",inset:0,background:"rgba(25,31,40,.5)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 24px"}}>
      <div className="shake" style={{background:"#fff",borderRadius:20,padding:"28px 24px",width:"100%",maxWidth:340,boxShadow:"0 8px 32px rgba(0,0,0,.18)"}}>
        <div style={{fontSize:36,textAlign:"center",marginBottom:12}}>⚠️</div>
        <div style={{fontSize:16,fontWeight:800,color:"#F04452",textAlign:"center",marginBottom:8}}>한도 초과!</div>
        <div style={{fontSize:13,color:"#4E5968",textAlign:"center",lineHeight:1.6,marginBottom:20,whiteSpace:"pre-line"}}>{msg}</div>
        <button onClick={onClose} style={{...S.btn,background:"#F04452",color:"#fff",boxShadow:"none"}}>확인</button>
      </div>
    </div>
  );
}

// ===================== 랜딩 페이지 (로그인 전) =====================
function LandingPage() {
  return (
    <div style={{...S.wrap, overflowY:"auto"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}button:active{transform:scale(0.97)!important;}::-webkit-scrollbar{display:none;}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}.su{animation:slideUp .35s cubic-bezier(.34,1.2,.64,1);}.fi{animation:fadeIn .4s ease;}`}</style>

      <div style={{background:"linear-gradient(160deg,#1E3A0F 0%,#2D4A1E 40%,#3D6B2A 80%,#556B2F 100%)",padding:"48px 24px 32px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,right:-40,width:220,height:220,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
        <div className="fi" style={{position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
            <div style={{fontSize:48}}>🐻</div>
            <div>
              <div style={{fontSize:34,fontWeight:900,color:"#fff",lineHeight:1}}>휴곰</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:2}}>군인과 곰신의 휴가 관리</div>
            </div>
          </div>
          <div style={{fontSize:17,fontWeight:700,color:"rgba(255,255,255,.95)",lineHeight:1.5}}>
            입대일 입력 하나로<br/>
            <span style={{color:"#A8D5A2"}}>모든 휴가 관리를 자동으로</span>
          </div>
        </div>
      </div>

      <div style={{padding:"20px 20px 0"}}>
        <div className="su" style={{display:"flex",flexDirection:"column",gap:10}}>
          {[
            {icon:"📅",title:"군인·곰신 함께 보는 휴가 달력",desc:"연가·포상·위로휴가·외박까지 한눈에"},
            {icon:"🪖",title:"계급·호봉 자동 계산",desc:"입대일만 입력하면 현재 계급, 진급일 자동 계산"},
            {icon:"🌿",title:"휴가 한도 관리",desc:"종류별 휴가를 등록하고 잔여 한도 관리"},
            {icon:"💌",title:"곰신의 날짜 선택 제안",desc:"원하는 날짜로 휴가·면회를 직접 제안"},
          ].map((f,i)=>(
            <div key={i} style={{display:"flex",gap:12,padding:"12px 14px",background:"#F9FAFB",borderRadius:14,border:"1px solid #F0F2F5",alignItems:"center"}}>
              <div style={{width:40,height:40,borderRadius:12,background:"linear-gradient(135deg,#2D4A1E,#556B2F)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{f.icon}</div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"#191F28",marginBottom:2}}>{f.title}</div>
                <div style={{fontSize:11,color:"#6B7685"}}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:"20px 20px 40px"}}>
        <button
          onClick={signInWithKakao}
          style={{
            width:"100%",padding:"16px",
            borderRadius:16,background:"#FEE500",
            color:"#191919",fontSize:16,fontWeight:800,
            border:"none",cursor:"pointer",
            boxShadow:"0 4px 20px rgba(254,229,0,.4)",
            display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#191919"><path d="M12 3C6.48 3 2 6.92 2 11.76c0 3.06 1.87 5.75 4.71 7.3l-1.2 4.47 4.98-3.3A11.5 11.5 0 0012 20.52c5.52 0 10-3.92 10-8.76C22 6.92 17.52 3 12 3z"/></svg>
          카카오로 시작하기
        </button>
        <div style={{textAlign:"center",fontSize:11,color:"#C0C8D4",marginTop:12}}>
          로그인 시 서비스 이용약관 및 개인정보처리방침에 동의하게 됩니다
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab,setTab]=useState("cal");
  const [leaves,setLeaves]=useState([]);
  const [schedules,setSchedules]=useState([]);
  const [notifs,setNotifs]=useState([]);
  const [friends,setFriends]=useState([]);
  const [showNotif,setShowNotif]=useState(false);
  const [profile,setProfile]=useState(null);
  const [viewingFriendId,setViewingFriendId]=useState(null);
  const [warnMsg,setWarnMsg]=useState("");
  // authState: "loading" | "no_user" | "need_onboarding" | "ready"
  const [authState,setAuthState]=useState("loading");
  const unread=notifs.filter(n=>!n.read).length;
  const perfDates=useMemo(()=>profile?calcOutingDates(profile.perf_first_start,profile.perf_cycle_weeks,profile.perf_cycle_days):[],[profile]);
  const markAllRead=()=>setNotifs(ns=>ns.map(n=>({...n,read:true})));

  // 앱 시작 시 인증 상태 + 프로필 확인
  useEffect(()=>{
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setAuthState("no_user");
          return;
        }
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("kakao_id", user.id)
          .single();

        if (data && !error) {
          setProfile({
            id: data.id,
            name: data.name,
            enlist: data.enlist_date,
            discharge: data.discharge_date,
            userType: data.role === "soldier" ? "soldier" : "gomshin",
            perf_first_start: data.perf_first_start || null,
            perf_cycle_weeks: data.perf_cycle_weeks || null,
            perf_cycle_days: data.perf_cycle_days || null,
            annual_limits: data.annual_limits || {이등병:null,일병:null,상병:null,병장:null},
            reward_limit: data.reward_limit || 6,
            missedMonths: data.missed_months || {},
            visitOutCycle: data.visit_out_cycle || null,
            invite_code: data.partner_code,
            partner_id: data.partner_id || null,
          });
          setAuthState("ready");
        } else {
          setAuthState("need_onboarding");
        }
      } catch(e) {
        console.error("인증 확인 실패", e);
        setAuthState("no_user");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        checkAuth();
      } else if (event === "SIGNED_OUT") {
        setAuthState("no_user");
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 프로필 로드 후 leaves/schedules/notifications 불러오기 + 파트너 데이터 로드
  useEffect(()=>{
    if (!profile?.id) return;
    const loadData = async () => {
      const [lv, sc, nt] = await Promise.all([
        supabase.from("leaves").select("*").eq("user_id", profile.id).order("start_date"),
        supabase.from("schedules").select("*").eq("user_id", profile.id).order("event_date"),
        supabase.from("notifications").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }),
      ]);
      if (lv.data) setLeaves(lv.data.map(l => ({
        id: l.id, leave_type: l.type, start_date: l.start_date, end_date: l.end_date, memo: l.memo,
      })));
      if (sc.data) setSchedules(sc.data.map(s => ({
        id: s.id, event_type: s.event_type, event_date: s.event_date, memo: s.memo,
      })));
      if (nt.data) setNotifs(nt.data.map(n => {
        let msg = n.message;
        try { if (typeof msg === "string") msg = JSON.parse(msg); } catch(e) {}
        return {
          id: n.id, type: msg?.type || "info", text: msg?.text || msg,
          dateRange: msg?.dateRange || null, time: "이전", read: n.is_read,
        };
      }));

      // 파트너 데이터 로드 (partner_id 있을 때)
      if (profile.partner_id) {
        await loadPartnerData(profile.partner_id);
      }
    };
    loadData();
  }, [profile?.id]);

  // 파트너 데이터 불러오기 함수
  const loadPartnerData = async (partnerId) => {
      const [pu, plv, psc, pk] = await Promise.all([
        supabase.from("users").select("*").eq("id", partnerId).single(),
        supabase.from("leaves").select("*").eq("user_id", partnerId).order("start_date"),
        supabase.from("schedules").select("*").eq("user_id", partnerId).order("event_date"),
        supabase.from("pokes").select("*").eq("receiver_id", partnerId).eq("sender_id", profile.id),
      ]);
    if (pu.data) {
      const pd = pu.data;
      const pokeData = pk.data?.[0];
      const partnerObj = {
        id: pd.id,
        name: pd.name,
        userType: pd.role === "soldier" ? "soldier" : "gomshin",
        enlist: pd.enlist_date,
        discharge: pd.discharge_date,
        perf_first_start: pd.perf_first_start,
        perf_cycle_weeks: pd.perf_cycle_weeks,
        perf_cycle_days: pd.perf_cycle_days,
        relation: pd.role === "soldier" ? "my_soldier" : "my_gomshin",
        status: "accepted",
        leaves: plv.data ? plv.data.map(l => ({ id: l.id, leave_type: l.type, start_date: l.start_date, end_date: l.end_date, memo: l.memo })) : [],
        schedules: psc.data ? psc.data.map(s => ({ id: s.id, event_type: s.event_type, event_date: s.event_date, memo: s.memo })) : [],
        pokeCount: pokeData?.count || 0,
      };
      setFriends([partnerObj]);
    }
  };

  // Realtime: 파트너가 보낸 알림 실시간 수신 (PHASE 4)
  useEffect(()=>{
    if (!profile?.id) return;
    const channel = supabase
      .channel("partner-notifs-" + profile.id)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${profile.id}`,
      }, (payload) => {
        const n = payload.new;
        let msg = n.message;
        try { if (typeof msg === "string") msg = JSON.parse(msg); } catch(e) {}
        setNotifs(prev => [{
          id: n.id,
          type: msg?.type || "info",
          text: msg?.text || msg,
          dateRange: msg?.dateRange || null,
          time: "방금",
          read: false,
        }, ...prev]);
      })
      .subscribe();
    
    // Realtime: 콕 찌르기 업데이트 수신
    const pokeChannel = supabase
      .channel("poke-updates-" + profile.id)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "pokes",
      }, (payload) => {
        const n = payload.new;
        if (n.sender_id === profile.id || n.receiver_id === profile.id) {
          setFriends(prev => prev.map(f => {
            // f.id가 찌른 사람 또는 받은 사람인 경우 (자기 자신과 연결된 경우도 포함)
            if (f.id === n.sender_id || f.id === n.receiver_id) {
              // 현재 화면에 표시된 친구(f.id)와 관련된 콕 찌르기 데이터(n)라면 업데이트
              if (n.sender_id === profile.id && n.receiver_id === f.id) {
                return { ...f, pokeCount: n.count };
              }
            }
            return f;
          }));
        }
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(pokeChannel);
    };
  }, [profile?.id]);

  const checkLimits=(newLeaves,existingLeaves)=>{
    if(!profile||profile.userType==="gomshin") return null;
    const rankInfo=calcRankInfo(profile.enlist,profile.missedMonths);
    const allLeaves=[...existingLeaves,...newLeaves];
    const warnings=[];
    const annualLimit=profile.annual_limits?.[rankInfo.currentRank];
    if(annualLimit){
      const used=allLeaves.filter(l=>l.leave_type==="annual").reduce((acc,l)=>acc+diffDays(l.start_date,l.end_date)+1,0);
      if(used>annualLimit) warnings.push(`🌿 연가: ${rankInfo.currentRank} 한도 ${annualLimit}일 → 현재 ${used}일 사용`);
    }
    const rewardLimit=profile.reward_limit;
    if(rewardLimit){
      const used=allLeaves.filter(l=>l.leave_type==="reward").reduce((acc,l)=>acc+diffDays(l.start_date,l.end_date)+1,0);
      if(used>rewardLimit) warnings.push(`🏅 포상휴가: 한도 ${rewardLimit}일 → 현재 ${used}일 사용`);
    }
    if(profile.perf_cycle_days){
      allLeaves.filter(l=>l.leave_type==="perf").forEach(l=>{
        const days=diffDays(l.start_date,l.end_date)+1;
        if(days>profile.perf_cycle_days) warnings.push(`⭐ 외박: 설정 ${profile.perf_cycle_days}일 초과 (${days}일 등록됨)`);
      });
    }
    return warnings.length>0?warnings.join("\n\n"):null;
  };

  const addLeave = async (ls) => {
    const arr = Array.isArray(ls) ? ls : [ls];
    for (const l of arr) {
      const forbidden = checkForbidden(l.memo);
      if (forbidden) {
        alert(`휴가 메모에 보안 위험 단어("${forbidden}")가 포함되어 있습니다. 수정 후 다시 시도해 주세요.`);
        return;
      }
    }
    const warn = checkLimits(arr, leaves);
    if (warn) setWarnMsg(warn);
    const rows = arr.map(l => ({
      user_id: profile.id,
      type: l.leave_type,
      start_date: l.start_date,
      end_date: l.end_date,
      days: diffDays(l.start_date, l.end_date) + 1,
      memo: l.memo || null,
    }));
    const { data, error } = await supabase.from("leaves").insert(rows).select();
    if (!error && data) {
      setLeaves(prev => [...prev, ...data.map(l => ({
        id: l.id, leave_type: l.type, start_date: l.start_date, end_date: l.end_date, memo: l.memo,
      }))]);
    }
  };

  const delLeave = async (id) => {
    await supabase.from("leaves").delete().eq("id", id);
    setLeaves(prev => prev.filter(l => l.id !== id));
  };

  const addSched = async (s) => {
    const { data, error } = await supabase.from("schedules").insert({
      user_id: profile.id,
      type: s.event_type,
      date: s.event_date,
      title: s.event_type,
      memo: s.memo || null,
    }).select().single();
    if (!error && data) {
      setSchedules(prev => [...prev, { id: data.id, event_type: data.type, event_date: data.date, memo: data.memo }]);
    }
  };

  const delSched = async (id) => {
    await supabase.from("schedules").delete().eq("id", id);
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const addNotif = async (notif) => {
    const { data, error } = await supabase.from("notifications").insert({
      user_id: notif.recipientId || profile.id,
      message: JSON.stringify({ type: notif.type, text: notif.text, dateRange: notif.dateRange || null }),
      is_read: false,
    }).select().single();
    if (!error && data) {
      setNotifs(prev => [{
        id: data.id, type: notif.type, text: notif.text,
        dateRange: notif.dateRange || null, time: "방금", read: false,
      }, ...prev]);
    }
  };

  // 콕 찌르기 함수
  const poke = async (recipientId) => {
    if (!profile?.id || !recipientId) return;
    
    try {
      // 1. 내가 상대방을 찌른 기록 확인
      const { data: myPoke } = await supabase
        .from("pokes")
        .select("*")
        .eq("sender_id", profile.id)
        .eq("receiver_id", recipientId)
        .single();
      
      // 2. 상대방이 나를 찌른 기록 확인
      const { data: theirPoke } = await supabase
        .from("pokes")
        .select("*")
        .eq("sender_id", recipientId)
        .eq("receiver_id", profile.id)
        .single();

      // 페이스북 스타일: 내가 이미 찔렀고 상대방이 아직 안 찔렀으면 못 찌름
      if (myPoke) {
        if (!theirPoke) {
          // 상대방이 한 번도 안 찔렀으면 못 찌름
          alert("상대방이 콕 찌를 때까지 기다려주세요! ⏳");
          return;
        }
        // 내 마지막 찌른 시간과 상대방 마지막 찌른 시간 비교
        const myLastTime = new Date(myPoke.last_poke_at).getTime();
        const theirLastTime = new Date(theirPoke.last_poke_at).getTime();
        if (myLastTime > theirLastTime) {
          // 내가 더 최근에 찔렀으면 못 찌름
          alert("상대방이 콕 찌를 때까지 기다려주세요! ⏳");
          return;
        }
      }
      
      // 콕 찌르기 실행
      if (myPoke) {
        // 이미 찌른 기록이 있으면 횟수 업데이트
        const newCount = myPoke.count + 1;
        const { error } = await supabase
          .from("pokes")
          .update({ count: newCount, last_poke_at: new Date().toISOString() })
          .eq("id", myPoke.id);
        if (!error) {
          // 로컬 상태 즉시 업데이트
          setFriends(f => f.map(friend => 
            friend.id === recipientId ? {...friend, pokeCount: newCount} : friend
          ));
          addNotif({
            type: "poke",
            text: `${profile.name}님이 콕 찌르셨어요! (${newCount}번)`,
            recipientId,
          });
        }
      } else {
        // 처음 찌르는 경우
        const { error } = await supabase.from("pokes").insert({
          sender_id: profile.id,
          receiver_id: recipientId,
          count: 1,
          last_poke_at: new Date().toISOString(),
        });
        if (!error) {
          // 로컬 상태 즉시 업데이트
          setFriends(f => f.map(friend => 
            friend.id === recipientId ? {...friend, pokeCount: 1} : friend
          ));
          addNotif({
            type: "poke",
            text: `${profile.name}님이 콕 찌르셨어요!`,
            recipientId,
          });
        }
      }
    } catch (err) {
      console.error("콕 찌르기 오류:", err);
      alert("콕 찌르기 중 오류가 발생했습니다.");
    }
  };

  // 파트너 연결 해제 (PHASE 4)
  const disconnectPartner = useCallback(async () => {
    if (!profile?.id) return;
    const partner = friends[0];
    await supabase.from("users").update({ partner_id: null }).eq("id", profile.id);
    if (partner?.id) await supabase.from("users").update({ partner_id: null }).eq("id", partner.id);
    setProfile(p => ({ ...p, partner_id: null }));
    setFriends([]);
  }, [profile?.id, friends]);

  const handleReset = async () => {
    if (profile?.id) {
      await Promise.all([
        supabase.from("leaves").delete().eq("user_id", profile.id),
        supabase.from("schedules").delete().eq("user_id", profile.id),
        supabase.from("notifications").delete().eq("user_id", profile.id),
        supabase.from("users").delete().eq("id", profile.id),
      ]);
    }
    setProfile(null);
    setLeaves([]);
    setSchedules([]);
    setNotifs([]);
    setFriends([]);
    setViewingFriendId(null);
    setAuthState("need_onboarding");
  };

  // ── 렌더 분기 ──
  if (authState === "loading") return (
    <div style={{...S.wrap, alignItems:"center", justifyContent:"center"}}>
      <div style={{fontSize:48}}>🐻</div>
      <div style={{fontSize:16,fontWeight:700,color:"#8B95A1",marginTop:12}}>불러오는 중...</div>
    </div>
  );

  // 로그인 안 된 상태 → 랜딩 페이지
  if (authState === "no_user") return <LandingPage />;

  // 로그인 됐지만 프로필 없음 → 온보딩 (군화/곰신 선택)
  if (authState === "need_onboarding") return (
    <Onboarding onComplete={async (profileData) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("users").insert({
        kakao_id: user.id,
        role: profileData.userType === "gomshin" ? "gomshin" : "soldier",
        name: profileData.name,
        enlist_date: profileData.enlist,
        discharge_date: profileData.discharge,
        partner_code: profileData.invite_code,
        perf_first_start: profileData.perf_first_start,
        perf_cycle_weeks: profileData.perf_cycle_weeks,
        perf_cycle_days: profileData.perf_cycle_days,
        annual_limits: profileData.annual_limits,
        reward_limit: profileData.reward_limit,
        missed_months: profileData.userType === "gomshin" ? {이등병:0,일병:0,상병:0} : profileData.missedMonths,
        visit_out_cycle: profileData.visitOutCycle,
      }).select().single();
      if (!error && data) {
        setProfile({ ...profileData, id: data.id });
        setAuthState("ready");
      } else {
        console.error("가입 오류:", error);
        alert("가입 오류: " + error?.message);
      }
    }}/>
  );

  // 로그인 + 프로필 있음 → 메인 앱
  const linkedSoldier=profile.userType==="gomshin"?friends.find(f=>f.relation==="my_soldier"&&f.status==="accepted"):null;
  const viewingFriend=viewingFriendId?friends.find(f=>f.id===viewingFriendId):null;
  const calLeaves=viewingFriend?(viewingFriend.leaves||[]):linkedSoldier?(linkedSoldier.leaves||[]):leaves;
  const calSchedules=viewingFriend?(viewingFriend.schedules||[]):linkedSoldier?(linkedSoldier.schedules||[]):schedules;
  const calOutingDates=viewingFriend?calcOutingDates(viewingFriend.perf_first_start,viewingFriend.perf_cycle_weeks,viewingFriend.perf_cycle_days):linkedSoldier?calcOutingDates(linkedSoldier.perf_first_start,linkedSoldier.perf_cycle_weeks,linkedSoldier.perf_cycle_days):perfDates;
  const calProfile=viewingFriend?viewingFriend:linkedSoldier?linkedSoldier:profile;
  const isGomshin=profile.userType==="gomshin";
  const isReadOnly=!!viewingFriend||!!linkedSoldier;
  const tabs=isGomshin
    ?[{id:"cal",icon:"📅",label:"달력"},{id:"friends",icon:"💝",label:"연결"},{id:"profile",icon:"⚙️",label:"내 정보"}]
    :[{id:"cal",icon:"📅",label:"달력"},{id:"leave",icon:"🏖️",label:"휴가"},{id:"friends",icon:"👥",label:"친구"},{id:"profile",icon:"⚙️",label:"내 정보"}];

  return (
    <div style={S.wrap}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}button:active{transform:scale(0.95)!important;transition:transform 0.08s;}::-webkit-scrollbar{display:none;}@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}.su{animation:slideUp .25s cubic-bezier(.34,1.2,.64,1);}.fi{animation:fadeIn .18s ease;}.shake{animation:shake .4s ease;}`}</style>
      <header style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {viewingFriend&&<button onClick={()=>setViewingFriendId(null)} style={{background:"#F2F4F6",border:"none",borderRadius:8,padding:"6px 10px",fontSize:13,fontWeight:600,color:"#4E5968",cursor:"pointer"}}>← 내 달력</button>}
          <div style={{fontSize:17,fontWeight:800,color:"#191F28"}}>
            {isGomshin?"🐻 휴곰 — 곰신 달력":"🐻 휴곰 — 군화 달력"}
            {viewingFriend&&<span style={{fontSize:13,color:"#8B95A1",fontWeight:500,marginLeft:6}}>{viewingFriend.name}의 달력</span>}
            {linkedSoldier&&!viewingFriend&&tab==="cal"&&<span style={{fontSize:11,color:"#8B95A1",fontWeight:500,marginLeft:6}}>{linkedSoldier.name} 보기</span>}
          </div>
        </div>
        <button onClick={()=>setShowNotif(true)} style={{position:"relative",background:"none",border:"none",padding:4,cursor:"pointer"}}>
          <span style={{fontSize:22}}>🔔</span>
          {unread>0&&<div style={{position:"absolute",top:0,right:0,width:16,height:16,borderRadius:"50%",background:"#F04452",color:"#fff",fontSize:9,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #fff"}}>{unread}</div>}
        </button>
      </header>
      {warnMsg&&<WarnModal msg={warnMsg} onClose={()=>setWarnMsg("")}/>}
      <div style={S.content}>
        {tab==="cal"&&<CalendarTab profile={calProfile} leaves={calLeaves} schedules={calSchedules} perfDates={calOutingDates} onAddLeave={isReadOnly?null:addLeave} onDelLeave={isReadOnly?null:delLeave} onAddSched={isReadOnly?null:addSched} onDelSched={isReadOnly?null:delSched} readOnly={isReadOnly} isGomshin={isGomshin} linkedSoldier={linkedSoldier} onAddNotif={addNotif} myName={profile.name}/>}
        {tab==="leave"&&!isGomshin&&<LeaveTab profile={profile} leaves={leaves} perfDates={perfDates} onAddLeave={addLeave} onDelLeave={delLeave}/>}
        {tab==="friends"&&<FriendsTab profile={profile} friends={friends} setFriends={setFriends} notifs={notifs} setNotifs={setNotifs} onViewFriendCal={(id)=>{setViewingFriendId(id);setTab("cal");}} onAddNotif={addNotif} onDisconnect={disconnectPartner} onPoke={poke}/>}
        {tab==="profile"&&<ProfileTab profile={profile} setAuthState={setAuthState} setProfile={async (updater) => {
          const next = typeof updater === "function" ? updater(profile) : updater;
          setProfile(next);
          if (next.id) {
            await supabase.from("users").update({
              perf_first_start: next.perf_first_start,
              perf_cycle_weeks: next.perf_cycle_weeks,
              perf_cycle_days: next.perf_cycle_days,
              annual_limits: next.annual_limits,
              reward_limit: next.reward_limit,
              missed_months: next.missedMonths,
              visit_out_cycle: next.visitOutCycle,
            }).eq("id", next.id);
          }
        }} leaves={leaves} onReset={handleReset}/>}
      </div>
      <nav style={S.tabBar}>
        {tabs.map(t=>(<button key={t.id} onClick={()=>{setTab(t.id);setViewingFriendId(null);}} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"transparent",border:"none",cursor:"pointer"}}><div style={{width:44,height:28,borderRadius:10,background:tab===t.id&&!viewingFriendId?(isGomshin?"#FFF0F8":"#EBF3FF"):"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"background .18s"}}><span style={{fontSize:19,filter:tab===t.id&&!viewingFriendId?"none":"grayscale(1) opacity(.4)"}}>{t.icon}</span></div><span style={{fontSize:10,fontWeight:tab===t.id&&!viewingFriendId?700:500,color:tab===t.id&&!viewingFriendId?(isGomshin?"#E91E8C":"#3182F6"):"#B0B8C1",transition:"color .18s"}}>{t.label}</span></button>))}
      </nav>
      {showNotif&&(
        <div className="fi" style={S.overlay} onClick={()=>{setShowNotif(false);markAllRead();}}>
          <div className="su" style={S.sheet} onClick={e=>e.stopPropagation()}>
            <div style={S.handle}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><span style={{fontSize:17,fontWeight:800}}>알림</span>{unread>0&&<button onClick={markAllRead} style={{fontSize:12,color:"#3182F6",fontWeight:700,background:"none",border:"none",cursor:"pointer"}}>모두 읽음</button>}</div>
            {notifs.length===0?<div style={{textAlign:"center",padding:"48px 0",color:"#B0B8C1",fontSize:14}}>알림이 없어요</div>:notifs.map(n=>(<div key={n.id} style={{display:"flex",gap:12,padding:"12px",borderRadius:12,background:n.read?"transparent":"#EBF3FF",marginBottom:4}}><div style={{width:38,height:38,borderRadius:12,background:"#F2F4F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{n.type==="leave_suggest"?"🌿":n.type==="visit_request"?"🏠":n.type==="visit_out_suggest"?"🚗":"💌"}</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:n.read?500:700,color:"#191F28",lineHeight:1.5}}>{n.text}</div>{n.dateRange&&<div style={{fontSize:12,color:"#3182F6",fontWeight:700,marginTop:3,padding:"3px 8px",background:"#EBF3FF",borderRadius:6,display:"inline-block"}}>📅 {n.dateRange}</div>}<div style={{fontSize:11,color:"#B0B8C1",marginTop:4}}>{n.time}</div></div>{!n.read&&<div style={{width:7,height:7,borderRadius:"50%",background:"#3182F6",marginTop:4,flexShrink:0}}/>}</div>))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== 온보딩 (신규 유저만) =====================
function Onboarding({onComplete}){
  const [userType,setUserType]=useState(null);
  const [name,setName]=useState("");
  const [enlist,setEnlist]=useState("");
  const [discharge,setDischarge]=useState("");
  const [err,setErr]=useState("");
  const [showRankOverride,setShowRankOverride]=useState(false);
  const [missedMonths,setMissedMonths]=useState({이등병:0,일병:0,상병:0});

  const autoRankInfo=useMemo(()=>{
    if(!enlist||userType==="gomshin") return null;
    try{ return calcRankInfo(enlist,{}); }catch{ return null; }
  },[enlist,userType]);

  const previewRankInfo=useMemo(()=>{
    if(!enlist||userType==="gomshin") return null;
    try{ return calcRankInfo(enlist,missedMonths); }catch{ return null; }
  },[enlist,missedMonths,userType]);

  const accent=userType==="gomshin"?"#E91E8C":"#3182F6";
  const accentShadow=userType==="gomshin"?"rgba(233,30,140,.28)":"rgba(49,130,246,.28)";

  const finish=()=>{
    if(!name.trim()) return setErr("이름을 입력해주세요");
    if(!enlist||!discharge) return setErr("입대일과 전역일을 입력해주세요");
    if(enlist>=discharge) return setErr("전역일이 입대일보다 늦어야 해요");
    const code=Math.random().toString(36).slice(2,8).toUpperCase();
    onComplete({name:name.trim(),enlist,discharge,userType,perf_first_start:null,perf_cycle_weeks:null,perf_cycle_days:null,annual_limits:{이등병:null,일병:null,상병:null,병장:null},reward_limit:6,missedMonths:userType==="gomshin"?{}:missedMonths,visitOutCycle:null,invite_code:code});
  };

  if(!userType) return(
    <div style={{...S.wrap,overflowY:"auto"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}button:active{transform:scale(0.95)!important;}::-webkit-scrollbar{display:none;}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}.su{animation:slideUp .35s cubic-bezier(.34,1.2,.64,1);}.fi{animation:fadeIn .4s ease;}`}</style>
      <div style={{background:"linear-gradient(160deg,#2D4A1E 0%,#3D5A1E 50%,#556B2F 100%)",padding:"52px 24px 36px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-20,width:180,height:180,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
        <div className="fi" style={{position:"relative"}}>
          <div style={{fontSize:54,marginBottom:6}}>🐻</div>
          <div style={{fontSize:28,fontWeight:900,color:"#fff",marginBottom:4}}>반가워요!</div>
          <div style={{fontSize:15,color:"rgba(255,255,255,.75)",lineHeight:1.6}}>나는 어떤 유형인가요?</div>
        </div>
      </div>
      <div style={{padding:"24px 20px 48px"}}>
        <div className="su" style={{display:"flex",flexDirection:"column",gap:14}}>
          <button onClick={()=>setUserType("soldier")} style={{padding:"22px 20px",borderRadius:20,border:"2px solid #8FA47A",background:"#F2E7D5",cursor:"pointer",textAlign:"left",display:"flex",gap:16,alignItems:"flex-start"}}>
            <div style={{width:48,height:48,borderRadius:14,background:"#556B2F",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>🐻</div>
            <div><div style={{fontSize:16,fontWeight:800,color:"#2D4A1E",marginBottom:4}}>군화 (현역 군인)</div><div style={{fontSize:12,color:"#556B2F",lineHeight:1.6}}>휴가 관리 · 외박 · 계급 자동 계산</div></div>
          </button>
          <button onClick={()=>setUserType("gomshin")} style={{padding:"22px 20px",borderRadius:20,border:"2px solid #F8BBD0",background:"#FFF5F9",cursor:"pointer",textAlign:"left",display:"flex",gap:16,alignItems:"flex-start"}}>
            <div style={{width:48,height:48,borderRadius:14,background:"#FFF0F8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,flexShrink:0}}>🧸</div>
            <div><div style={{fontSize:16,fontWeight:800,color:"#C2185B",marginBottom:4}}>곰신 (기다리는 사람)</div><div style={{fontSize:12,color:"#C2185B",opacity:.7,lineHeight:1.6}}>군화 달력 함께 보기 · 날짜 선택 면회 제안</div></div>
          </button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{...S.wrap,padding:"0 24px 48px",overflowY:"auto"}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}button:active{transform:scale(0.95)!important;}::-webkit-scrollbar{display:none;}@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}.su{animation:slideUp .25s cubic-bezier(.34,1.2,.64,1);}`}</style>
      <div style={{paddingTop:52,paddingBottom:28}}>
        <button onClick={()=>{setUserType(null);setErr("");}} style={{fontSize:13,color:"#8B95A1",background:"none",border:"none",cursor:"pointer",marginBottom:20}}>← 유형 선택</button>
        <div style={{fontSize:22,fontWeight:800,color:"#191F28",marginBottom:4}}>{userType==="gomshin"?"기다리는 사람 정보":"기본 정보 입력"}</div>
        <div style={{fontSize:13,color:"#8B95A1"}}>나머지 세부 설정은 앱 안에서 언제든 할 수 있어요</div>
      </div>
      <div className="su" style={{display:"flex",flexDirection:"column",gap:16}}>
        <Field label="이름"><input style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder={userType==="gomshin"?"홍길순":"홍길동"}/></Field>
        <Field label={userType==="gomshin"?"군화 입대일":"입대일"}>
          <input style={S.input} type="date" value={enlist} onChange={e=>setEnlist(e.target.value)}/>
          {autoRankInfo&&enlist&&!showRankOverride&&(
            <div style={{marginTop:8,padding:"12px 14px",background:"#EBF3FF",borderRadius:14,border:"1px solid #A5C9FF",display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div>
                <div style={{fontSize:13,color:"#3182F6",fontWeight:700}}>🪖 현재: <span style={{fontSize:15}}>{autoRankInfo.currentRank}</span> <span style={{fontWeight:500,color:"#8B95A1"}}>{autoRankInfo.hobon}호봉</span></div>
                {autoRankInfo.nextRankKey&&<div style={{fontSize:11,color:"#8B95A1",marginTop:2}}>다음 진급: <span style={{color:"#191F28",fontWeight:700}}>{fmtDate(autoRankInfo.nextRankKey)}</span></div>}
              </div>
              <button onClick={()=>setShowRankOverride(true)} style={{flexShrink:0,padding:"7px 10px",background:"#fff",border:"1.5px solid #A5C9FF",borderRadius:10,fontSize:11,fontWeight:700,color:"#3182F6",cursor:"pointer",lineHeight:1.4,textAlign:"center"}}>이 계급이<br/>아니에요</button>
            </div>
          )}
          {showRankOverride&&enlist&&(
            <div style={{marginTop:8,background:"#F9FAFB",borderRadius:16,padding:"14px 16px",border:"2px solid #3182F6"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#191F28"}}>진급 직접 조정</div>
                <button onClick={()=>{setShowRankOverride(false);setMissedMonths({이등병:0,일병:0,상병:0});}} style={{fontSize:11,color:"#8B95A1",background:"#F2F4F6",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer"}}>자동으로</button>
              </div>
              <div style={{fontSize:11,color:"#8B95A1",marginBottom:10}}>늦게 진급한 계급이 있다면 개월 수 입력 (없으면 0)</div>
              {["이등병","일병","상병"].map(r=>(
                <div key={r} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{width:52,height:30,borderRadius:8,background:"#E8ECF0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:11,fontWeight:700,color:"#8B95A1"}}>{r}</span></div>
                  <input style={{...S.input,flex:1,height:40,padding:"8px 12px",fontSize:14}} type="number" min="0" max="24" value={missedMonths[r]||""} onChange={e=>setMissedMonths(p=>({...p,[r]:parseInt(e.target.value)||0}))} placeholder="0"/>
                  <span style={{fontSize:12,color:"#8B95A1",flexShrink:0}}>개월 늦게</span>
                </div>
              ))}
              {previewRankInfo&&(
                <div style={{marginTop:8,padding:"10px 12px",background:"#EBF3FF",borderRadius:12,border:"1px solid #A5C9FF"}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#3182F6",marginBottom:4}}>적용 후: {previewRankInfo.currentRank} {previewRankInfo.hobon}호봉</div>
                  {["이등병","일병","상병"].map(r=>(<div key={r} style={{fontSize:11,color:"#4E5968"}}>{r}→{RANK_LABELS[RANK_LABELS.indexOf(r)+1]}: <span style={{fontWeight:700}}>{fmtDate(previewRankInfo.promotions[r])}</span></div>))}
                </div>
              )}
            </div>
          )}
        </Field>
        <Field label={userType==="gomshin"?"군화 전역 예정일":"전역 예정일"}><input style={S.input} type="date" value={discharge} onChange={e=>setDischarge(e.target.value)}/></Field>
        {userType==="gomshin"&&<div style={{padding:"12px 14px",background:"#FFF0F8",borderRadius:12,fontSize:13,color:"#C2185B",lineHeight:1.6,border:"1px solid #F8BBD0"}}>💡 군화 코드는 나중에 연결 탭에서 입력해요</div>}
        <div style={{padding:"12px 14px",background:"#F9FAFB",borderRadius:12,fontSize:12,color:"#8B95A1",lineHeight:1.8,border:"1px solid #E8ECF0"}}>
          ✅ <b>설정 탭에서 나중에 할 수 있는 것</b><br/>외박 주기 · 연가/포상 한도 · 면회외출 텀
        </div>
      </div>
      {err&&<div style={{marginTop:12,fontSize:13,color:"#F04452",padding:"10px 14px",background:"#FFF0F1",borderRadius:12,fontWeight:500}}>{err}</div>}
      <div style={{marginTop:28}}>
        <button style={{...S.btn,background:accent,color:"#fff",boxShadow:`0 4px 14px ${accentShadow}`}} onClick={finish}>{userType==="gomshin"?"시작하기 💝":"시작하기 ✈️"}</button>
      </div>
    </div>
  );
}

function Field({label,sub,children}){return(<div><div style={{fontSize:13,fontWeight:600,color:"#333D4B",marginBottom:6}}>{label}{sub&&<span style={{fontSize:11,color:"#B0B8C1",marginLeft:6,fontWeight:400}}>{sub}</span>}</div>{children}</div>);}
function CalendarTab({profile,leaves,schedules,perfDates,onAddLeave,onDelLeave,onAddSched,onDelSched,readOnly,isGomshin,linkedSoldier,onAddNotif,myName}){
  const today=new Date();
  const [vy,setVy]=useState(today.getFullYear());
  const [vm,setVm]=useState(today.getMonth());
  const [selKey,setSelKey]=useState(null);
  const [showModal,setShowModal]=useState(false);
  const [showPicker,setShowPicker]=useState(false);
  const [showGomshinPanel,setShowGomshinPanel]=useState(false);
  const [toastMsg,setToastMsg]=useState("");
  const todayKey=toKey(today);
  const showToast=(msg)=>{setToastMsg(msg);setTimeout(()=>setToastMsg(""),2500);};
  const firstDay=new Date(vy,vm,1).getDay();
  const daysInM=new Date(vy,vm+1,0).getDate();
  const perfSet=useMemo(()=>{const s=new Set();perfDates.forEach(pd=>{let d=pd.start;while(d<=pd.end){s.add(d);d=addDays(d,1);}});return s;},[perfDates]);
  const perfStartSet=useMemo(()=>new Set(perfDates.map(p=>p.start)),[perfDates]);
  const leaveByDate=useMemo(()=>{const m={};leaves.forEach(l=>{let d=l.start_date;while(d<=l.end_date){if(!m[d])m[d]=[];m[d].push(l);d=addDays(d,1);}});return m;},[leaves]);
  const schedByDate=useMemo(()=>{const m={};schedules.forEach(s=>{if(!m[s.event_date])m[s.event_date]=[];m[s.event_date].push(s);});return m;},[schedules]);
  const nextOuting=perfDates.find(p=>p.end>=todayKey);
  const handleGomshinSuggest=(type,dateRange)=>{
    if(!linkedSoldier||!onAddNotif) return;
    const labels={leave_suggest:"🌿 휴가 제안",visit_request:"🏠 영내면회 제안",visit_out_suggest:"🚗 면회외출 제안"};
    onAddNotif({type,text:`${myName}(님이 ${labels[type]}을 보냈어요 💝`,dateRange:dateRange||null});
    showToast(`${labels[type]}을 보냈어요!`);setShowGomshinPanel(false);
  };
  return(
    <div>
      {toastMsg&&<div style={{position:"fixed",top:68,left:"50%",transform:"translateX(-50%)",background:"#191F28",color:"#fff",padding:"10px 20px",borderRadius:100,fontSize:13,fontWeight:600,zIndex:200,whiteSpace:"nowrap"}}>{toastMsg}</div>}
      <div style={{padding:"16px 16px 0"}}>
        <div style={{background:isGomshin?"linear-gradient(135deg,#FF4081,#E91E8C)":"linear-gradient(135deg,#2D4A1E,#556B2F)",borderRadius:20,padding:"18px 20px",boxShadow:isGomshin?"0 4px 16px rgba(233,30,140,.28)":"0 4px 16px rgba(61,90,30,.35)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.65)",fontWeight:600,marginBottom:4}}>전역까지</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{fontSize:42,fontWeight:900,color:"#fff",lineHeight:1}}>D-{diffDays(todayKey,profile.discharge)}</div><div style={{fontSize:28}}>🐻</div></div>
              <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:6}}>{profile.discharge} 전역예정</div>
            </div>
            {nextOuting&&(<div style={{textAlign:"right",background:"rgba(255,255,255,.15)",borderRadius:12,padding:"10px 14px"}}><div style={{fontSize:10,color:"rgba(255,255,255,.65)",marginBottom:4}}>다음 외박</div><div style={{fontSize:13,fontWeight:700,color:"#FFD966"}}>{nextOuting.start}</div><div style={{fontSize:11,color:"rgba(255,255,255,.5)"}}>D-{Math.max(0,diffDays(todayKey,nextOuting.start))}일 후</div></div>)}
          </div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 20px 8px"}}>
        <button onClick={()=>vm===0?(setVm(11),setVy(y=>y-1)):setVm(m=>m-1)} style={{width:36,height:36,borderRadius:10,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>‹</button>
        <div style={{fontSize:20,fontWeight:800,color:"#191F28"}}>{vy}년 {vm+1}월</div>
        <button onClick={()=>vm===11?(setVm(0),setVy(y=>y+1)):setVm(m=>m+1)} style={{width:36,height:36,borderRadius:10,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>›</button>
      </div>
      {!readOnly&&(<div style={{display:"flex",gap:8,padding:"0 16px 12px",overflowX:"auto"}}>
        <button onClick={()=>setShowPicker(true)} style={{flexShrink:0,padding:"8px 16px",borderRadius:100,background:"#3182F6",color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:"pointer"}}>+ 휴가 등록</button>
        <button onClick={()=>{setSelKey(todayKey);setShowModal(true);}} style={{flexShrink:0,padding:"8px 14px",borderRadius:100,background:"#F2F4F6",color:"#4E5968",fontSize:13,fontWeight:600,border:"none",cursor:"pointer"}}>+ 면회·외출</button>
      </div>)}
      {readOnly&&isGomshin&&linkedSoldier&&(<div style={{padding:"6px 16px 12px",display:"flex",gap:8,alignItems:"center"}}><div style={{padding:"8px 14px",background:"#FFF0F8",borderRadius:10,fontSize:12,color:"#E91E8C",fontWeight:600}}>👀 {linkedSoldier.name}의 달력</div><button onClick={()=>setShowGomshinPanel(true)} style={{padding:"8px 16px",borderRadius:10,background:"linear-gradient(135deg,#FF4081,#E91E8C)",color:"#fff",fontSize:12,fontWeight:700,border:"none",cursor:"pointer"}}>💌 제안하기</button></div>)}
      {readOnly&&!isGomshin&&(<div style={{padding:"6px 16px 12px"}}><div style={{padding:"8px 14px",background:"#FFF8E8",borderRadius:10,fontSize:12,color:"#FF9500",fontWeight:600}}>👀 읽기 전용 보기</div></div>)}
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 4px"}}>
        {DAY_LABELS.map((d,i)=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,padding:"4px 0",color:i===0?"#F04452":i===6?"#3182F6":"#B0B8C1"}}>{d}</div>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",padding:"0 4px 20px",borderTop:"1px solid #F2F4F6"}}>
        {Array(firstDay).fill(null).map((_,i)=><div key={"b"+i} style={{minHeight:78}}/>)}
        {Array.from({length:daysInM},(_,i)=>i+1).map(d=>{
          const key=toKey(new Date(vy,vm,d));
          const col=(firstDay+d-1)%7,isSun=col===0,isSatD=col===6;
          const isHol=!!HOLIDAYS[key],isToday=key===todayKey;
          const isPerf=perfSet.has(key),isPerfStart=perfStartSet.has(key);
          const perfIdx=isPerfStart?perfDates.findIndex(p=>p.start===key):-1;
          const dayLeaves=leaveByDate[key]||[];
          const dayScheds=schedByDate[key]||[];
          let cellBg="transparent";
          if(isToday) cellBg="#EBF3FF";
          if(dayLeaves.length>0){const lt=LEAVE_TYPES[dayLeaves[0].leave_type];if(lt)cellBg=lt.bg;}
          return(
            <div key={key} onClick={()=>{if(!readOnly){setSelKey(key);setShowModal(true);}}} style={{minHeight:78,padding:"6px 3px 4px",background:cellBg,borderTop:"1px solid #F2F4F6",borderRight:col<6?"1px solid #F2F4F6":"none",cursor:readOnly?"default":"pointer"}}>
              <div style={{width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:isToday?"#3182F6":"transparent",marginBottom:1}}>
                <span style={{fontSize:13,fontWeight:isToday?800:400,lineHeight:1,color:isToday?"#fff":isSun||isHol?"#F04452":isSatD?"#3182F6":"#191F28"}}>{d}</span>
              </div>
              {isHol&&<div style={{fontSize:6.5,fontWeight:700,color:"#fff",background:"#F04452",borderRadius:3,padding:"1px 3px",marginBottom:1,display:"inline-block",maxWidth:"100%",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{HOLIDAYS[key]}</div>}
              {isPerf&&dayLeaves.length===0&&(isPerfStart?<div style={{fontSize:7,fontWeight:700,color:"#FF6B00",background:"#FFF2E8",borderRadius:3,padding:"1px 3px",display:"inline-block"}}>⭐{perfIdx+1}차</div>:<div style={{height:2,background:"#FBBF24",borderRadius:1,margin:"3px 2px 0",opacity:0.5}}/>)}
              <div style={{display:"flex",flexDirection:"column",gap:1.5,marginTop:1}}>
                {dayLeaves.slice(0,2).map((l,i)=>{const lt=LEAVE_TYPES[l.leave_type];if(!lt)return null;return(<div key={i} style={{fontSize:7.5,fontWeight:700,borderRadius:4,padding:"2px 4px",background:lt.color,color:"#fff",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:2}}><span>{lt.icon}</span><span>{lt.label}</span></div>);})}
                {dayScheds.slice(0,1).map((s,i)=>{const et=EVENT_TYPES[s.event_type];if(!et)return null;return(<div key={i} style={{fontSize:7.5,fontWeight:700,borderRadius:4,padding:"2px 4px",background:et.bg,color:et.color,border:`1px solid ${et.border}`,overflow:"hidden",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:2}}><span>{et.icon}</span><span>{s.title || et.label}</span></div>);})}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{padding:"0 16px 24px",display:"flex",flexWrap:"wrap",gap:10}}>
        {Object.values(LEAVE_TYPES).map(v=>(<div key={v.label} style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:v.color}}/><span style={{fontSize:11,color:"#8B95A1"}}>{v.label}</span></div>))}
      </div>
      {showModal&&selKey&&<EventModal dateKey={selKey} leaves={leaves} schedules={schedules} profile={profile} onAddLeave={onAddLeave} onDelLeave={onDelLeave} onAddSched={onAddSched} onDelSched={onDelSched} onClose={()=>setShowModal(false)}/>}
      {showPicker&&<MultiRangePicker onClose={()=>setShowPicker(false)} onDone={(ls)=>{onAddLeave(ls);setShowPicker(false);}}/>}
      {showGomshinPanel&&linkedSoldier&&<GomshinSuggestPanel partnerName={linkedSoldier.name} onSend={handleGomshinSuggest} onClose={()=>setShowGomshinPanel(false)}/>}
    </div>
  );
}

function EventModal({dateKey,leaves,schedules,profile,onAddLeave,onDelLeave,onAddSched,onDelSched,onClose}){
  const [evType,setEvType]=useState("visit_in");
  const [memo,setMemo]=useState("");
  const [visitOutWarn,setVisitOutWarn]=useState(null);
  const [confirmOverride,setConfirmOverride]=useState(false);
  const dayLeaves=leaves.filter(l=>l.start_date<=dateKey&&l.end_date>=dateKey);
  const dayScheds=schedules.filter(s=>s.event_date===dateKey);
  const red=isRedDay(dateKey),sat=isSat(dateKey),offday=isOffDay(dateKey);
  const dow=["일","월","화","수","목","금","토"][new Date(dateKey).getDay()];
  const hol=HOLIDAYS[dateKey];
  const checkVisitOutCycle=()=>{
    const cycle=profile?.visitOutCycle;
    if(!cycle||evType!=="visit_out") return null;
    const prevVisits=schedules.filter(s=>s.event_type==="visit_out"&&s.event_date<dateKey).sort((a,b)=>b.event_date.localeCompare(a.event_date));
    if(prevVisits.length===0) return null;
    const lastDate=prevVisits[0].event_date;
    const daysPassed=diffDays(lastDate,dateKey);
    const daysRequired=cycle*7;
    if(daysPassed<daysRequired){const daysLeft=daysRequired-daysPassed;const okDate=addDays(lastDate,daysRequired);return {lastDate,daysPassed,daysLeft,okDate};}
    return null;
  };
  const handleRegister=()=>{
    const forbidden = checkForbidden(memo);
    if (forbidden) {
      alert(`보안 위험 단어("${forbidden}")가 포함되어 있어 등록할 수 없습니다. 군사보안을 준수해 주세요.`);
      return;
    }
    if(evType==="visit_out"&&!confirmOverride){const warn=checkVisitOutCycle();if(warn){setVisitOutWarn(warn);return;}}
    onAddSched({event_type:evType,event_date:dateKey,memo:memo.trim()||null});setMemo("");onClose();
  };
  const evColor=EVENT_TYPES[evType]?.color||"#3182F6";
  return(
    <div className="fi" style={S.overlay} onClick={onClose}>
      <div className="su" style={S.sheet} onClick={e=>e.stopPropagation()}>
        <div style={S.handle}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
          <div style={{width:48,height:48,borderRadius:14,background:red?"#FFF0F1":sat?"#EBF3FF":"#F2F4F6",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:18,fontWeight:800,color:red?"#F04452":sat?"#3182F6":"#191F28",lineHeight:1}}>{Number(dateKey.split("-")[2])}</div>
            <div style={{fontSize:9,fontWeight:600,color:red?"#F04452":sat?"#3182F6":"#8B95A1"}}>{dow}</div>
          </div>
          <div><div style={{fontSize:16,fontWeight:800}}>{dateKey.slice(0,7).replace("-","년 ")}월 {Number(dateKey.split("-")[2])}일</div>{hol&&<div style={{fontSize:12,color:"#F04452",fontWeight:600,marginTop:2}}>🔴 {hol}</div>}</div>
        </div>
        {dayLeaves.length>0&&<><div style={S.sectionTitle}>등록된 휴가</div>{dayLeaves.map(l=>{const lt=LEAVE_TYPES[l.leave_type];if(!lt)return null;return(<div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,background:lt.bg,border:`1px solid ${lt.border}`,marginBottom:6}}><span style={{fontSize:18}}>{lt.icon}</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:lt.color}}>{lt.label}</div><div style={{fontSize:11,color:"#8B95A1"}}>{l.start_date} ~ {l.end_date}</div></div><button onClick={()=>onDelLeave(l.id)} style={{fontSize:12,color:"#F04452",fontWeight:700,padding:"4px 8px",background:"rgba(240,68,82,.08)",borderRadius:6,border:"none",cursor:"pointer"}}>삭제</button></div>);})}</>}
        {dayScheds.length>0&&<><div style={{...S.sectionTitle,marginTop:14}}>등록된 일정</div>{dayScheds.map(s=>{const et=EVENT_TYPES[s.event_type];if(!et)return null;return(<div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,background:et.bg,border:`1px solid ${et.border}`,marginBottom:6}}><span style={{fontSize:18}}>{et.icon}</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:et.color}}>{et.label}</div>{s.memo&&<div style={{fontSize:11,color:"#8B95A1"}}>{s.memo}</div>}</div><button onClick={()=>onDelSched(s.id)} style={{fontSize:12,color:"#F04452",fontWeight:700,padding:"4px 8px",background:"rgba(240,68,82,.08)",borderRadius:6,border:"none",cursor:"pointer"}}>삭제</button></div>);})}</>}
        <div style={{fontSize:10,color:"#F04452",fontWeight:600,marginBottom:8,lineHeight:1.4}}>⚠️ 군사보안 위반 관련 글 작성 시 법적 책임은 본인에게 있습니다</div>
        <div style={{...S.sectionTitle,marginTop:16}}>일정 추가</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
          {Object.entries(EVENT_TYPES).map(([k,v])=>{const disabled=false;return(<button key={k} onClick={()=>{if(!disabled){setEvType(k);setVisitOutWarn(null);setConfirmOverride(false);}}} style={{...S.chip,borderColor:evType===k&&!disabled?v.color:"#E8ECF0",background:evType===k&&!disabled?v.bg:"#fff",color:evType===k&&!disabled?v.color:"#4E5968",opacity:disabled?.4:1,cursor:disabled?"not-allowed":"pointer"}}>{v.icon} {v.label}</button>);})}
        </div>
        {visitOutWarn&&!confirmOverride&&(
          <div style={{marginBottom:12,padding:"14px 16px",background:"#FFF8E8",borderRadius:14,border:"1.5px solid #FFCC80"}}>
            <div style={{fontSize:14,fontWeight:800,color:"#E65100",marginBottom:8}}>⚠️ 면회외출 텀 미충족</div>
            <div style={{fontSize:13,color:"#5D4037",lineHeight:1.7,marginBottom:10}}>마지막: <b>{fmtDate(visitOutWarn.lastDate)}</b><br/><span style={{color:"#E65100",fontWeight:700}}>다음 가능일: {fmtDate(visitOutWarn.okDate)}</span></div>
            <div style={{display:"flex",gap:8}}><button onClick={onClose} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:13,fontWeight:700,color:"#4E5968",cursor:"pointer"}}>취소</button><button onClick={()=>setConfirmOverride(true)} style={{flex:1,padding:"10px",borderRadius:10,border:"none",background:"#FF9800",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>그래도 등록</button></div>
          </div>
        )}
        <input style={{...S.input,marginBottom:12}} value={memo} onChange={e=>setMemo(e.target.value)} placeholder="메모 (선택사항)"/>
        <button style={{...S.btn,background:evColor,color:"#fff",boxShadow:`0 4px 14px ${evColor}55`}} onClick={handleRegister}>
          {EVENT_TYPES[evType]?.icon} {EVENT_TYPES[evType]?.label} 등록{evType==="visit_out"&&visitOutWarn&&confirmOverride?" (텀 무시)":""}
        </button>
      </div>
    </div>
  );
}
function GomshinSuggestPanel({partnerName,onSend,onClose}){
  const [step,setStep]=useState("type");const [selectedType,setSelectedType]=useState(null);const [dateStart,setDateStart]=useState(null);const [dateEnd,setDateEnd]=useState(null);const [hoverKey,setHoverKey]=useState(null);
  const today=new Date();const [vy,setVy]=useState(today.getFullYear());const [vm,setVm]=useState(today.getMonth());
  const SUGGEST_TYPES=[{type:"leave_suggest",icon:"🌿",label:"휴가 제안",desc:"이때 휴가 나와줘!",color:"#05C072",bg:"#E8FBF3",border:"#B7F0D5"},{type:"visit_request",icon:"🏠",label:"영내면회 제안",desc:"면회 갈게!",color:"#3182F6",bg:"#EBF3FF",border:"#A5C9FF"},{type:"visit_out_suggest",icon:"🚗",label:"면회외출 제안",desc:"같이 외출하자!",color:"#7C3AED",bg:"#F3EEFF",border:"#C9B2F8"}];
  const cfg=SUGGEST_TYPES.find(t=>t.type===selectedType)||SUGGEST_TYPES[0];
  const firstDay=new Date(vy,vm,1).getDay();const daysInM=new Date(vy,vm+1,0).getDate();
  const tapDate=k=>{if(!dateStart||(dateStart&&dateEnd)){setDateStart(k);setDateEnd(null);}else if(k<dateStart){setDateStart(k);setDateEnd(null);}else setDateEnd(k);};
  const previewEnd=dateEnd||(dateStart&&hoverKey&&hoverKey>dateStart?hoverKey:null);
  const inRange=k=>dateStart&&previewEnd&&k>dateStart&&k<previewEnd;
  const dateRangeStr=()=>{if(!dateStart)return null;if(!dateEnd||dateStart===dateEnd)return fmtDate(dateStart);return `${fmtDate(dateStart)} ~ ${fmtDate(dateEnd)} (${diffDays(dateStart,dateEnd)+1}일)`;};
  return(
    <div className="fi" style={{...S.overlay,zIndex:120}} onClick={onClose}>
      <div className="su" style={{...S.sheet,paddingBottom:32}} onClick={e=>e.stopPropagation()}>
        <div style={S.handle}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div><div style={{fontSize:17,fontWeight:800}}>💌 {partnerName}에게 제안</div></div>
          {step!=="type"&&<button onClick={()=>setStep("type")} style={{fontSize:12,color:"#8B95A1",background:"#F2F4F6",border:"none",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontWeight:600}}>← 이전</button>}
        </div>
        {step==="type"&&(<div style={{display:"flex",flexDirection:"column",gap:10}}>{SUGGEST_TYPES.map(item=>(<button key={item.type} onClick={()=>{setSelectedType(item.type);setStep("date");}} style={{padding:"14px 16px",borderRadius:16,border:`1.5px solid ${item.border}`,background:item.bg,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:14}}><div style={{width:44,height:44,borderRadius:12,background:item.color+"22",border:`1.5px solid ${item.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{item.icon}</div><div><div style={{fontSize:15,fontWeight:700,color:item.color}}>{item.label}</div><div style={{fontSize:12,color:"#8B95A1",marginTop:2}}>{item.desc}</div></div></button>))}</div>)}
        {step==="date"&&(
          <div>
            <div style={{padding:"10px 14px",borderRadius:12,background:cfg.bg,border:`1px solid ${cfg.border}`,marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:20}}>{cfg.icon}</span>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:cfg.color}}>{cfg.label}</div><div style={{fontSize:11,color:"#8B95A1"}}>{dateStart?(dateEnd?`${fmtDate(dateStart)} ~ ${fmtDate(dateEnd)} (${diffDays(dateStart,dateEnd)+1}일)`:`${fmtDate(dateStart)} → 종료일 탭`):"시작일을 탭하세요"}</div></div>
              {dateStart&&dateEnd&&<button onClick={()=>{setDateStart(null);setDateEnd(null);}} style={{fontSize:11,color:"#F04452",background:"rgba(240,68,82,.08)",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer"}}>지우기</button>}
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
              <button onClick={()=>vm===0?(setVm(11),setVy(y=>y-1)):setVm(m=>m-1)} style={{width:28,height:28,borderRadius:8,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>‹</button>
              <span style={{fontSize:13,fontWeight:700}}>{vy}년 {vm+1}월</span>
              <button onClick={()=>vm===11?(setVm(0),setVy(y=>y+1)):setVm(m=>m+1)} style={{width:28,height:28,borderRadius:8,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>›</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:4}}>{DAY_LABELS.map((d,i)=><div key={d} style={{textAlign:"center",fontSize:10,fontWeight:700,color:i===0?"#F04452":i===6?"#3182F6":"#B0B8C1",padding:"2px 0"}}>{d}</div>)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
              {Array(firstDay).fill(null).map((_,i)=><div key={"b"+i}/>)}
              {Array.from({length:daysInM},(_,i)=>i+1).map(d=>{
                const key=toKey(new Date(vy,vm,d));const col=(firstDay+d-1)%7,isSun=col===0,isSatD=col===6;const isHol=!!HOLIDAYS[key];
                const isS=key===dateStart,isE=key===dateEnd,inR=inRange(key);
                let bg="transparent",fg="#191F28",br="transparent";
                if(isS||isE){bg=cfg.color;fg="#fff";br=cfg.color;}else if(inR){bg=cfg.color+"28";fg=cfg.color;br=cfg.color+"55";}
                if((isHol||isSun)&&!isS&&!isE)fg="#F04452";if(isSatD&&!isS&&!isE)fg="#3182F6";
                return(<div key={key} onClick={()=>tapDate(key)} onMouseEnter={()=>{if(dateStart&&!dateEnd)setHoverKey(key);}} onMouseLeave={()=>setHoverKey(null)} style={{height:36,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:bg,border:`1.5px solid ${br}`,borderRadius:isS||isE?8:4,cursor:"pointer",userSelect:"none"}}><span style={{fontSize:12,fontWeight:isS||isE?800:400,color:fg,lineHeight:1}}>{d}</span>{isHol&&<span style={{fontSize:5,color:isS||isE?"rgba(255,255,255,.75)":"#F04452",lineHeight:1}}>{HOLIDAYS[key].slice(0,2)}</span>}</div>);
              })}
            </div>
            <div style={{marginTop:16}}>
              <button onClick={()=>onSend(selectedType,dateRangeStr())} disabled={!dateStart} style={{...S.btn,background:dateStart?cfg.color:"#E8ECF0",color:dateStart?"#fff":"#B0B8C1",boxShadow:dateStart?`0 4px 14px ${cfg.color}44`:"none",cursor:dateStart?"pointer":"default"}}>
                {cfg.icon} {cfg.label} 보내기{dateStart?` (${dateRangeStr()})`: ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MultiRangePicker({onClose,onDone}){
  const [activeLt,setActiveLt]=useState("annual");const [selections,setSelections]=useState({});const [hoverKey,setHoverKey]=useState(null);const [memo,setMemo]=useState("");
  const today=new Date();const [vy,setVy]=useState(today.getFullYear());const [vm,setVm]=useState(today.getMonth());
  const months=[{y:vy,m:vm},{y:vm===11?vy+1:vy,m:vm===11?0:vm+1}];
  const cfg=LEAVE_TYPES[activeLt];const curSel=selections[activeLt]||{start:null,end:null};
  const updateSel=(lt,patch)=>setSelections(prev=>({...prev,[lt]:{...(prev[lt]||{start:null,end:null}),...patch}}));
  const tap=k=>{const{start,end}=curSel;if(!start||(start&&end)){updateSel(activeLt,{start:k,end:null});}else if(k<start){updateSel(activeLt,{start:k,end:null});}else updateSel(activeLt,{start,end:k});};
  const removeType=lt=>setSelections(prev=>{const n={...prev};delete n[lt];return n;});
  const previewEnd=curSel.end||(curSel.start&&hoverKey&&hoverKey>curSel.start?hoverKey:null);
  const inActiveRange=k=>curSel.start&&previewEnd&&k>curSel.start&&k<previewEnd;
  const otherTypeFor=k=>Object.entries(selections).find(([lt,s])=>lt!==activeLt&&s.start&&s.end&&k>=s.start&&k<=s.end);
  const confirmedEntries=Object.entries(selections).filter(([,s])=>s.start&&s.end);
  const totalDays=confirmedEntries.reduce((acc,[,s])=>acc+diffDays(s.start,s.end)+1,0);
  const canSave=confirmedEntries.length>0;
  const handleSave=()=>{const arr=confirmedEntries.map(([lt,s])=>({leave_type:lt,start_date:s.start,end_date:s.end,memo:memo.trim()||null}));if(arr.length===0)return;onDone(arr);};
  return(
    <div style={{position:"fixed",inset:0,background:"#fff",zIndex:200,display:"flex",flexDirection:"column"}}>
      <div style={{background:`linear-gradient(135deg,${cfg.color}cc,${cfg.color})`,padding:"14px 20px 10px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <button onClick={onClose} style={{fontSize:13,color:"rgba(255,255,255,.8)",fontWeight:600,padding:"6px 12px",background:"rgba(255,255,255,.15)",borderRadius:8,border:"none",cursor:"pointer"}}>취소</button>
          <span style={{fontSize:15,fontWeight:700,color:"#fff"}}>복합 휴가 등록</span>
          <button onClick={handleSave} disabled={!canSave} style={{fontSize:13,fontWeight:700,padding:"6px 14px",borderRadius:8,border:"none",cursor:canSave?"pointer":"default",background:canSave?"#fff":"rgba(255,255,255,.2)",color:canSave?cfg.color:"rgba(255,255,255,.4)"}}>완료 {canSave?`(${totalDays}일)`:""}</button>
        </div>
        <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:8,paddingBottom:2}}>
          {Object.entries(LEAVE_TYPES).map(([k,v])=>{const sel=selections[k];const hasRange=sel&&sel.start&&sel.end;const isActive=activeLt===k;return(<button key={k} onClick={()=>setActiveLt(k)} style={{flexShrink:0,padding:"5px 11px",borderRadius:100,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",background:isActive?"rgba(255,255,255,.95)":hasRange?"rgba(255,255,255,.35)":"rgba(255,255,255,.18)",color:isActive?cfg.color:hasRange?"#fff":"rgba(255,255,255,.75)",position:"relative"}}>{v.icon} {v.label}{hasRange&&<span style={{position:"absolute",top:-3,right:-3,width:10,height:10,borderRadius:"50%",background:"#FFD700",border:"1.5px solid rgba(255,255,255,.6)"}}/>}</button>);})}
        </div>
        <div style={{display:"flex",alignItems:"center",background:"rgba(255,255,255,.15)",borderRadius:12,padding:"8px 14px"}}>
          <div style={{fontSize:15,marginRight:8}}>{cfg.icon}</div>
          <div style={{flex:1}}><div style={{fontSize:10,color:"rgba(255,255,255,.65)",fontWeight:600,marginBottom:2}}>{cfg.label}</div><div style={{fontSize:14,fontWeight:700,color:"#fff"}}>{curSel.start&&curSel.end?`${curSel.start.slice(5).replace("-","/")} ~ ${curSel.end.slice(5).replace("-","/")} (${diffDays(curSel.start,curSel.end)+1}일)`:curSel.start?"종료일 선택":"시작일을 선택하세요"}</div></div>
          {curSel.start&&curSel.end&&<button onClick={()=>removeType(activeLt)} style={{fontSize:12,color:"rgba(255,255,255,.7)",background:"rgba(255,255,255,.15)",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontWeight:600}}>지우기</button>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 16px",background:"#F9FAFB",borderBottom:"1px solid #E8ECF0",flexShrink:0}}>
        <button onClick={()=>vm===0?(setVm(11),setVy(y=>y-1)):setVm(m=>m-1)} style={{width:30,height:30,borderRadius:8,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>‹</button>
        <span style={{fontSize:13,fontWeight:700}}>{vy}년 {vm+1}월 · {vm===11?vy+1:vy}년 {vm===11?1:vm+2}월</span>
        <button onClick={()=>vm===11?(setVm(0),setVy(y=>y+1)):setVm(m=>m+1)} style={{width:30,height:30,borderRadius:8,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>›</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"8px 12px 12px"}}>
        {months.map(({y,m})=>{const first=new Date(y,m,1).getDay(),days=new Date(y,m+1,0).getDate();return(<div key={`${y}-${m}`} style={{marginBottom:14}}><div style={{textAlign:"center",fontSize:13,fontWeight:700,color:"#8B95A1",padding:"5px 0 7px"}}>{y}년 {m+1}월</div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",marginBottom:3}}>{DAY_LABELS.map((d,i)=><div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:i===0?"#F04452":i===6?"#3182F6":"#B0B8C1",padding:"2px 0"}}>{d}</div>)}</div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>{Array(first).fill(null).map((_,i)=><div key={"b"+i}/>)}{Array.from({length:days},(_,i)=>i+1).map(d=>{const key=toKey(new Date(y,m,d));const col=(first+d-1)%7,isSun=col===0,isSatD=col===6;const isHol=!!HOLIDAYS[key];const isS=key===curSel.start,isE=key===curSel.end;const inR=inActiveRange(key);const otherType=otherTypeFor(key);let bg="transparent",fg="#191F28",br="transparent";if(isS||isE){bg=cfg.color;fg="#fff";br=cfg.color;}else if(inR){bg=cfg.color+"28";fg=cfg.color;br=cfg.color+"55";}else if(otherType){const olt=LEAVE_TYPES[otherType[0]];bg=olt.bg;br=olt.border;}if((isHol||isSun)&&!isS&&!isE)fg=inR?cfg.color:"#F04452";if(isSatD&&!isS&&!isE)fg=inR?cfg.color:"#3182F6";return(<div key={key} onClick={()=>tap(key)} onMouseEnter={()=>{if(curSel.start&&!curSel.end)setHoverKey(key);}} onMouseLeave={()=>setHoverKey(null)} style={{height:42,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:bg,border:`1.5px solid ${br}`,borderRadius:isS||isE?10:inR?2:7,cursor:"pointer",userSelect:"none"}}><span style={{fontSize:13,fontWeight:isS||isE?800:400,color:fg,lineHeight:1}}>{d}</span>{isHol&&<span style={{fontSize:5.5,color:isS||isE?"rgba(255,255,255,.75)":"#F04452",lineHeight:1}}>{HOLIDAYS[key].slice(0,2)}</span>}{otherType&&!isS&&!isE&&!inR&&<div style={{width:4,height:4,borderRadius:"50%",background:LEAVE_TYPES[otherType[0]]?.color,marginTop:1}}/>}</div>);})}</div></div>);})}
        {confirmedEntries.length>0&&(<div style={{margin:"4px 2px 8px",padding:"12px 14px",background:"#F9FAFB",borderRadius:14,border:"1px solid #E8ECF0"}}><div style={{fontSize:11,fontWeight:700,color:"#8B95A1",marginBottom:8}}>등록 예정 ({confirmedEntries.length}종류 · 총 {totalDays}일)</div>{confirmedEntries.map(([lt,s])=>{const ltCfg=LEAVE_TYPES[lt];const d=diffDays(s.start,s.end)+1;return(<div key={lt} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}><span style={{fontSize:14}}>{ltCfg.icon}</span><div style={{flex:1}}><span style={{fontSize:13,fontWeight:600,color:ltCfg.color}}>{ltCfg.label}</span><span style={{fontSize:11,color:"#8B95A1",marginLeft:6}}>{s.start.slice(5).replace("-","/")} ~ {s.end.slice(5).replace("-","/")} ({d}일)</span></div><button onClick={()=>removeType(lt)} style={{fontSize:11,color:"#F04452",background:"rgba(240,68,82,.08)",border:"none",borderRadius:5,padding:"3px 6px",cursor:"pointer"}}>삭제</button></div>);})}</div>)}
        <input style={{...S.input,margin:"2px 2px 8px",width:"calc(100% - 4px)"}} value={memo} onChange={e=>setMemo(e.target.value)} placeholder="메모 (선택사항)"/>
      </div>
      {canSave&&(<div style={{padding:"10px 16px 26px",background:"#fff",borderTop:"1px solid #E8ECF0"}}><button style={{...S.btn,background:"#3182F6",color:"#fff",boxShadow:"0 4px 14px rgba(49,130,246,.28)"}} onClick={handleSave}>{confirmedEntries.length}가지 휴가 저장 ({totalDays}일) ✓</button></div>)}
    </div>
  );
}
function LeaveTab({profile,leaves,perfDates,onAddLeave,onDelLeave}){
  const [showPicker,setShowPicker]=useState(false);
  const today=toKey(new Date());
  const rankInfo=calcRankInfo(profile.enlist,profile.missedMonths);
  const {currentRank,hobon,nextRankKey}=rankInfo;
  const usedDays=(type)=>leaves.filter(l=>l.leave_type===type).reduce((acc,l)=>acc+diffDays(l.start_date,l.end_date)+1,0);
  const nextOuting=perfDates.find(p=>p.end>=today);
  const upcoming=leaves.filter(l=>l.end_date>=today).sort((a,b)=>a.start_date.localeCompare(b.start_date));
  const past=leaves.filter(l=>l.end_date<today).sort((a,b)=>b.start_date.localeCompare(a.start_date));
  const annualUsed=usedDays("annual");const annualLimit=profile.annual_limits?.[currentRank];
  const rewardUsed=usedDays("reward");const rewardLimit=profile.reward_limit;
  const annualOver=annualLimit&&annualUsed>annualLimit;const rewardOver=rewardLimit&&rewardUsed>rewardLimit;
  return(
    <div style={{padding:"16px 16px 24px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:"linear-gradient(135deg,#2D4A1E,#556B2F)",borderRadius:16,padding:"14px 18px",boxShadow:"0 4px 16px rgba(61,90,30,.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontSize:11,color:"rgba(255,255,255,.65)",fontWeight:600,marginBottom:4}}>현재 계급</div><div style={{fontSize:28,fontWeight:900,color:"#fff",lineHeight:1}}>{currentRank}</div><div style={{fontSize:12,color:"rgba(255,255,255,.7)",marginTop:4}}>{hobon}호봉</div></div>
          {nextRankKey&&(<div style={{textAlign:"right",background:"rgba(255,255,255,.15)",borderRadius:10,padding:"10px 14px"}}><div style={{fontSize:10,color:"rgba(255,255,255,.65)",marginBottom:4}}>다음 진급 예정</div><div style={{fontSize:14,fontWeight:800,color:"#FFD966"}}>{fmtDate(nextRankKey)}</div><div style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:2}}>D-{Math.max(0,diffDays(today,nextRankKey))}일 후</div></div>)}
        </div>
      </div>
      {(annualOver||rewardOver)&&(
        <div style={{padding:"12px 14px",background:"#FFF0F1",borderRadius:12,border:"1px solid #FFD0D0",fontSize:13,color:"#F04452",fontWeight:600,lineHeight:1.8}}>
          {annualOver&&<div>⚠️ {currentRank} 연가 한도({annualLimit}일) 초과! 현재 {annualUsed}일</div>}
          {rewardOver&&<div>⚠️ 포상휴가 한도({rewardLimit}일) 초과! 현재 {rewardUsed}일</div>}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[{type:"annual",limit:annualLimit},{type:"reward",limit:rewardLimit},{type:"comfort",limit:null},{type:"perf",limit:null},{type:"outing",limit:null}].map(({type,limit})=>{
          const lt=LEAVE_TYPES[type];const used=usedDays(type);const over=limit&&used>limit;
          return(<div key={type} style={{background:over?"#FFF0F1":lt.bg,borderRadius:16,padding:14,border:`1px solid ${over?"#FFD0D0":lt.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><span style={{fontSize:16}}>{lt.icon}</span><span style={{fontSize:12,fontWeight:700,color:over?"#F04452":lt.color}}>{lt.label}</span>{over&&<span style={{fontSize:9,color:"#F04452",background:"#FFE0E0",borderRadius:4,padding:"1px 5px",fontWeight:700}}>초과</span>}</div>
            <div style={{fontSize:28,fontWeight:900,color:over?"#F04452":lt.color,lineHeight:1}}>{used}{limit!=null&&<span style={{fontSize:13,color:(over?"#F04452":lt.color)+"80",fontWeight:500}}>/{limit}</span>}</div>
            <div style={{fontSize:10,color:"#8B95A1",marginTop:3}}>사용일</div>
            {limit!=null&&<div style={{marginTop:8,height:3,background:over?"#FFD0D0":lt.color+"22",borderRadius:2}}><div style={{height:"100%",width:`${Math.min(100,(used/limit)*100)}%`,background:over?"#F04452":lt.color,borderRadius:2}}/></div>}
          </div>);
        })}
      </div>
      {nextOuting&&(<div style={{background:"#FFF2E8",borderRadius:16,padding:"14px 16px",border:"1px solid #FFD0A8",display:"flex",alignItems:"center",gap:12}}><span style={{fontSize:28}}>⭐</span><div><div style={{fontSize:11,color:"#FF6B00",fontWeight:700}}>{nextOuting.idx+1}차 외박</div><div style={{fontSize:16,fontWeight:800,marginTop:2}}>{nextOuting.start} ~ {nextOuting.end}</div><div style={{fontSize:12,color:"#8B95A1",marginTop:2}}>D-{Math.max(0,diffDays(today,nextOuting.start))}일 후 · {nextOuting.days}일</div></div></div>)}
      {upcoming.length>0&&<><div style={S.sectionTitle}>다가오는 휴가</div>{upcoming.map(l=><LeaveCard key={l.id} leave={l} onDelete={()=>onDelLeave(l.id)}/>)}</>}
      {past.length>0&&<><div style={{...S.sectionTitle,marginTop:4}}>지난 휴가</div>{past.map(l=><LeaveCard key={l.id} leave={l} onDelete={()=>onDelLeave(l.id)} past/>)}</>}
      <button style={{...S.btn,background:"#3182F6",color:"#fff",boxShadow:"0 4px 14px rgba(49,130,246,.28)"}} onClick={()=>setShowPicker(true)}>+ 휴가 등록</button>
      {showPicker&&<MultiRangePicker onClose={()=>setShowPicker(false)} onDone={(ls)=>{onAddLeave(ls);setShowPicker(false);}}/>}
    </div>
  );
}
function LeaveCard({leave,onDelete,past}){
  const lt=LEAVE_TYPES[leave.leave_type];if(!lt)return null;
  const days=diffDays(leave.start_date,leave.end_date)+1;
  return(<div style={{background:past?"#F9FAFB":lt.bg,borderRadius:16,padding:"14px 16px",border:`1px solid ${past?"#E8ECF0":lt.border}`,marginBottom:8,display:"flex",alignItems:"center",gap:12}}><div style={{width:42,height:42,borderRadius:12,background:past?"#E8ECF0":lt.color+"22",border:`1.5px solid ${past?"#D1D6DB":lt.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{lt.icon}</div><div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:past?"#8B95A1":lt.color}}>{lt.label}</div><div style={{fontSize:12,color:"#4E5968",marginTop:2}}>{leave.start_date} ~ {leave.end_date}</div><div style={{fontSize:11,color:"#B0B8C1"}}>{days}일{leave.memo?" · "+leave.memo:""}</div></div><button onClick={onDelete} style={{padding:"6px 10px",background:"rgba(240,68,82,.08)",border:"none",borderRadius:8,fontSize:12,color:"#F04452",fontWeight:700,cursor:"pointer"}}>삭제</button></div>);
}

// ===================== 친구 탭 (데모 로직 삭제, 실제 DB 연동만 유지) =====================
function FriendsTab({profile,friends,setFriends,notifs,setNotifs,onViewFriendCal,onAddNotif,onDisconnect,onPoke}){
  const [subTab,setSubTab]=useState("list");
  const [code,setCode]=useState("");
  const [found,setFound]=useState(null);
  const [toast,setToast]=useState("");
  const [showGomshinSuggest,setShowGomshinSuggest]=useState(false);
  const [expandedFriendId,setExpandedFriendId]=useState(null);
  const today=toKey(new Date());
  const isGomshin=profile.userType==="gomshin";
  const accepted=friends.filter(f=>f.status==="accepted");
  const myBf=accepted.find(f=>f.relation==="my_soldier") || (isGomshin ? accepted[0] : null);
  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(""),2800);};

  // 실제 DB 조회
  const searchCode=async()=>{
    if(code.length<4){showToast("코드를 입력해주세요");return;}
    const { data, error } = await supabase.from("users").select("*").eq("partner_code", code.toUpperCase()).single();
    if (error || !data) { showToast("해당 코드를 찾을 수 없어요"); return; }
    setFound({
      id: data.id, name: data.name, userType: data.role,
      discharge: data.discharge_date, enlist: data.enlist_date,
      perf_first_start: data.perf_first_start, perf_cycle_weeks: data.perf_cycle_weeks,
      perf_cycle_days: data.perf_cycle_days, leaves: [], schedules: [],
    });
  };

  // 연결 요청 — 실제 DB에 양방향 partner_id 저장 (PHASE 4)
  const sendRequest=async()=>{
    if(!found||!profile?.id)return;
    // 나의 partner_id 업데이트
    const { error: e1 } = await supabase.from("users").update({ partner_id: found.id }).eq("id", profile.id);
    // 상대방의 partner_id 업데이트
    const { error: e2 } = await supabase.from("users").update({ partner_id: profile.id }).eq("id", found.id);
    if (e1 || e2) { showToast("연결 실패. 다시 시도해주세요."); return; }
    // 로컬 profile에 partner_id 반영
    profile.partner_id = found.id;
    // 파트너 데이터 로드
    const rel=isGomshin?"my_soldier":"my_gomshin";
    const partnerObj={...found,relation:rel,status:"accepted"};
    setFriends([partnerObj]);
    const msg=isGomshin?`${found.name}님의 군화와 연결됐어요! 파트너 달력을 확인해보세요 💝`:`${found.name}님과 연결됐어요!`;
    showToast(msg);
    setSubTab("list");setCode("");setFound(null);
  };

  const handleGomshinSend=(type,dateRange)=>{
    if(!myBf||!onAddNotif)return;
    const labels={leave_suggest:"🌿 휴가 제안",visit_request:"🏠 영내면회 제안",visit_out_suggest:"🚗 면회외출 제안"};
    onAddNotif({type,text:`${profile.name}님이 ${labels[type]}을 보냈어요 💝`,dateRange,recipientId:myBf.id});
    showToast(`${labels[type]}을 보냈어요!`);
    setShowGomshinSuggest(false);
  };

  const accent=isGomshin?"#E91E8C":"#3182F6";
  return(
    <div style={{display:"flex",flexDirection:"column"}}>
      {toast&&<div style={{position:"fixed",top:68,left:"50%",transform:"translateX(-50%)",background:"#191F28",color:"#fff",padding:"10px 20px",borderRadius:100,fontSize:13,fontWeight:600,zIndex:200,whiteSpace:"nowrap"}}>{toast}</div>}
      <div style={{display:"flex",gap:0,padding:"12px 16px",borderBottom:"1px solid #F2F4F6"}}>
        {["list","add"].map(t=>(<button key={t} onClick={()=>setSubTab(t)} style={{flex:1,padding:9,borderRadius:12,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",background:subTab===t?accent:"#F2F4F6",color:subTab===t?"#fff":"#8B95A1"}}>{t==="list"?`${isGomshin?"연결":"친구"} 목록 (${accepted.length})`:(isGomshin?"+ 군화 연결":"+ 친구 추가")}</button>))}
      </div>

      {subTab==="list"&&(
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
          {/* 곰신: 연결된 군화 카드 */}
          {isGomshin&&myBf&&(<>
            <div style={{background:"linear-gradient(135deg,#FF4081,#E91E8C)",borderRadius:20,padding:"16px 18px"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,.7)",fontWeight:600,marginBottom:8}}>연결된 군화</div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:44,height:44,borderRadius:14,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🪖</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:17,fontWeight:800,color:"#fff"}}>{myBf.name}</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,.7)",marginTop:2}}>D-{Math.max(0,diffDays(today,myBf.discharge))}일 전역까지</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <button onClick={()=>onViewFriendCal(myBf.id)} style={{padding:"8px 12px",background:"rgba(255,255,255,.9)",color:"#E91E8C",borderRadius:12,border:"none",fontSize:12,fontWeight:800,cursor:"pointer"}}>📅 달력</button>
                  <button onClick={()=>{if(window.confirm("파트너 연결을 해제할까요?"))onDisconnect();}} style={{padding:"6px 10px",background:"rgba(255,255,255,.2)",color:"rgba(255,255,255,.8)",borderRadius:10,border:"1px solid rgba(255,255,255,.3)",fontSize:11,fontWeight:600,cursor:"pointer"}}>연결해제</button>
                </div>
              </div>
            </div>
            <div style={{background:"#FFF0F8",borderRadius:16,padding:"14px 16px",border:"1px solid #F8BBD0"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#C2185B",marginBottom:10}}>💝 날짜 선택해서 제안하기</div>
              <button onClick={()=>setShowGomshinSuggest(true)} style={{...S.btn,background:"linear-gradient(135deg,#FF4081,#E91E8C)",color:"#fff",boxShadow:"0 4px 14px rgba(233,30,140,.3)"}}>💌 날짜 선택해서 제안 보내기</button>
            </div>
            <div style={{background:"#FFF8E8",borderRadius:16,padding:"14px 16px",border:"1px solid #FFDB9A"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#E65100",marginBottom:10}}>👋 콕 찌르기</div>
              <button onClick={()=>onPoke(myBf.id)} style={{...S.btn,background:"linear-gradient(135deg,#FF9500,#FF6B00)",color:"#fff",boxShadow:"0 4px 14px rgba(255,107,0,.3)"}}>👉 콕 찌르기{myBf.pokeCount>0?` (${myBf.pokeCount}번)`:""}</button>
            </div>
          </>)}
          {isGomshin&&!myBf&&(
            <div style={{textAlign:"center",padding:"40px 0",color:"#B0B8C1"}}>
              <div style={{fontSize:40,marginBottom:12}}>💝</div>
              <div style={{fontSize:14,fontWeight:600,color:"#E91E8C"}}>군화를 아직 연결하지 않았어요</div>
              <div style={{fontSize:12,color:"#B0B8C1",marginTop:6}}>친구 추가 탭에서 군화 코드를 입력해요</div>
            </div>
          )}

          {/* 군화: 친구 목록 - 아코디언 스타일 */}
          {!isGomshin&&<>
            {accepted.length>0
              ? accepted.map(f=>(
                <div key={f.id} style={{display:"flex",flexDirection:"column",gap:0}}>
                  <div onClick={()=>setExpandedFriendId(expandedFriendId===f.id?null:f.id)} style={{...S.card,display:"flex",alignItems:"center",gap:12,cursor:"pointer",borderRadius:expandedFriendId===f.id?"16px 16px 0 0":"16px",transition:"all 0.2s",marginBottom:0}}>
                    <div style={{width:40,height:40,borderRadius:12,background:"#F2F4F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                      {f.userType==="soldier"?"🪖":"💝"}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:700,color:"#191F28"}}>{f.name}</div>
                      <div style={{fontSize:11,color:"#8B95A1",marginTop:1}}>
                        {f.userType==="soldier"?`D-${Math.max(0,diffDays(today,f.discharge))}일 전역까지`:"연결된 친구"}
                      </div>
                    </div>
                    <div style={{fontSize:18,color:"#8B95A1",transition:"transform 0.2s",transform:expandedFriendId===f.id?"rotate(180deg)":"rotate(0deg)"}}>▼</div>
                  </div>
                  {expandedFriendId===f.id&&(
                    <div style={{background:"#F9FAFB",borderRadius:"0 0 16px 16px",padding:"10px 14px",display:"flex",flexDirection:"column",gap:8,borderLeft:"1px solid #E8ECF0",borderRight:"1px solid #E8ECF0",borderBottom:"1px solid #E8ECF0"}}>
                      {/* 달력 버튼 */}
                      <button onClick={()=>onViewFriendCal(f.id)} style={{padding:"8px 12px",background:"#EBF3FF",color:"#3182F6",borderRadius:10,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>📅 파트너 달력</button>
                      {/* 휴가/면회 제안 버튼 */}
                      <button onClick={()=>{setFound(f);setShowGomshinSuggest(true);}} style={{padding:"8px 12px",background:"#3182F6",color:"#fff",borderRadius:10,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>💌 휴가/면회 제안</button>
                      {/* 콕 찌르기 버튼 */}
                      <button onClick={()=>onPoke(f.id)} style={{padding:"8px 12px",background:"linear-gradient(135deg,#FF9500,#FF6B00)",color:"#fff",borderRadius:10,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>👉 콕 찌르기{f.pokeCount>0?` (${f.pokeCount}번)`:""}</button>
                      {/* 연결해제 버튼 */}
                      <button onClick={()=>{if(window.confirm("파트너 연결을 해제할까요?"))onDisconnect();}} style={{padding:"8px 12px",background:"#FFF0F1",color:"#F04452",borderRadius:10,border:"none",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>연결해제</button>
                    </div>
                  )}
                </div>
              ))
              : (
                <div style={{textAlign:"center",padding:"60px 0",color:"#B0B8C1"}}>
                  <div style={{fontSize:40,marginBottom:12}}>👥</div>
                  <div style={{fontSize:14,fontWeight:600}}>연결된 친구가 없어요</div>
                  <div style={{fontSize:12,marginTop:6}}>친구 추가 탭에서 코드로 연결해요</div>
                </div>
              )
            }
          </>}


        </div>
      )}

      {subTab==="add"&&(
        <div style={{padding:16,display:"flex",flexDirection:"column",gap:16}}>
          {/* 내 초대 코드 */}
          <div style={{background:isGomshin?"linear-gradient(135deg,#FF4081,#E91E8C)":"#EBF3FF",borderRadius:20,padding:18,border:isGomshin?"none":"1px solid #A5C9FF"}}>
            <div style={{fontSize:12,color:isGomshin?"rgba(255,255,255,.8)":"#3182F6",fontWeight:700,marginBottom:8}}>내 초대 코드</div>
            <div style={{fontSize:34,fontWeight:900,color:isGomshin?"#fff":"#3182F6",letterSpacing:6,textAlign:"center",marginBottom:10}}>{profile.invite_code}</div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{ navigator.clipboard?.writeText(profile.invite_code); showToast("코드가 복사됐어요!"); }} style={{...S.btn,flex:1,background:isGomshin?"rgba(255,255,255,.2)":"#3182F6",color:"#fff",boxShadow:"none",border:isGomshin?"1px solid rgba(255,255,255,.3)":"none"}}>코드 복사</button>
              <button onClick={()=>{
                if(navigator.share){
                  navigator.share({title:"휴곰 초대 코드", text:`휴곰에서 저와 연결해요! 초대 코드: ${profile.invite_code}`, url:window.location.origin});
                } else {
                  showToast("공유 기능을 지원하지 않는 브라우저입니다.");
                }
              }} style={{...S.btn,flex:1,background:isGomshin?"#fff":"#F2F4F6",color:isGomshin?"#E91E8C":"#4E5968",boxShadow:"none",border:"none"}}>공유하기</button>
            </div>
          </div>

          {/* 코드 검색 */}
          <div>
            <div style={{fontSize:13,fontWeight:600,color:"#333D4B",marginBottom:6}}>{isGomshin?"군화 코드 입력":"친구 코드 입력"}</div>
            <div style={{display:"flex",gap:8}}>
              <input style={{...S.input,flex:1,textAlign:"center",fontSize:20,fontWeight:800,letterSpacing:4}} value={code} onChange={e=>setCode(e.target.value.toUpperCase().slice(0,6))} placeholder="AB12CD"/>
              <button onClick={searchCode} style={{padding:"0 16px",background:accent,color:"#fff",borderRadius:12,border:"none",fontSize:14,fontWeight:700,cursor:"pointer"}}>검색</button>
            </div>
          </div>

          {found&&(
            <div style={S.card}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                <div style={{width:44,height:44,borderRadius:14,background:"#F2F4F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🪖</div>
                <div>
                  <div style={{fontSize:16,fontWeight:800}}>{found.name}</div>
                  <div style={{fontSize:12,color:"#8B95A1",marginTop:2}}>D-{Math.max(0,diffDays(today,found.discharge))}일 남음</div>
                </div>
              </div>
              <button style={{...S.btn,background:accent,color:"#fff",boxShadow:`0 4px 14px ${isGomshin?"rgba(233,30,140,.28)":"rgba(49,130,246,.28)"}`}} onClick={sendRequest}>
                {found.name}님{isGomshin?"의 군화와":"에게"} 연결하기
              </button>
            </div>
          )}
        </div>
      )}

      {showGomshinSuggest&&myBf&&<GomshinSuggestPanel partnerName={myBf.name} onSend={handleGomshinSend} onClose={()=>setShowGomshinSuggest(false)}/>}
    </div>
  );
}

function ProfileTab({profile,setProfile,leaves,onReset,setAuthState}){
  const today=toKey(new Date());
  const left=Math.max(0,diffDays(today,profile.discharge));
  const total=diffDays(profile.enlist,profile.discharge);
  const served=Math.max(0,Math.min(total,diffDays(profile.enlist,today)));
  const pct=Math.min(100,Math.round(served/total*100));
  const isGomshin=profile.userType==="gomshin";
  const rankInfo=isGomshin?null:calcRankInfo(profile.enlist,profile.missedMonths);
  const [showRankEdit,setShowRankEdit]=useState(false);
  const [editMissed,setEditMissed]=useState({...(profile.missedMonths||{이등병:0,일병:0,상병:0})});
  const saveRankEdit=()=>{setProfile(p=>({...p,missedMonths:editMissed}));setShowRankEdit(false);};
  return(
    <div style={{padding:"16px 16px 32px",display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:isGomshin?"linear-gradient(135deg,#FF4081,#E91E8C)":"linear-gradient(135deg,#2D4A1E,#556B2F)",borderRadius:20,padding:20,boxShadow:isGomshin?"0 4px 16px rgba(233,30,140,.28)":"0 4px 16px rgba(61,90,30,.35)"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
          <div style={{width:52,height:52,borderRadius:16,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{isGomshin?"💝":"✈️"}</div>
          <div><div style={{fontSize:20,fontWeight:800,color:"#fff"}}>{profile.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,.65)",marginTop:2}}>{isGomshin?"기다리는 중 💝":rankInfo?`복무 중 · ${rankInfo.currentRank} ${rankInfo.hobon}호봉`:"복무 중"}</div></div>
        </div>
        <div style={{background:"rgba(255,255,255,.15)",borderRadius:12,padding:"12px 16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div><div style={{fontSize:11,color:"rgba(255,255,255,.6)"}}>{isGomshin?"군화 전역까지":"전역까지"}</div><div style={{fontSize:32,fontWeight:900,color:"#fff",lineHeight:1}}>D-{left}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"rgba(255,255,255,.6)"}}>초대 코드</div><div style={{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:3}}>{profile.invite_code}</div></div>
          </div>
          <div style={{height:6,background:"rgba(255,255,255,.2)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:"rgba(255,255,255,.7)",borderRadius:3}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6,fontSize:10,color:"rgba(255,255,255,.6)"}}><span>복무 {pct}%</span><span>{served}일 / {total}일</span></div>
        </div>
      </div>

      {!isGomshin&&rankInfo&&(
        <div style={S.card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700}}>🪖 진급 스케줄</div>
            <button onClick={()=>setShowRankEdit(true)} style={{fontSize:12,color:"#3182F6",fontWeight:700,background:"#EBF3FF",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>수정</button>
          </div>
          {RANK_LABELS.map((r,i)=>{
            const isLast=i===RANK_LABELS.length-1;const isCurrent=r===rankInfo.currentRank;
            const getStartDate=()=>i===0?profile.enlist:rankInfo.promotions[RANK_LABELS[i-1]];
            const getNextDate=()=>isLast?profile.discharge:rankInfo.promotions[r];
            const startDate=getStartDate();const nextDate=getNextDate();
            const isPast=nextDate&&nextDate<=today&&!isLast;const dLeft=nextDate?Math.max(0,diffDays(today,nextDate)):null;
            return(
              <div key={r} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"10px 0",borderBottom:i<RANK_LABELS.length-1?"1px solid #F2F4F6":"none"}}>
                <div style={{width:52,height:30,borderRadius:8,flexShrink:0,marginTop:2,background:isCurrent?"#3182F6":isPast?"#B0B8C1":"#F2F4F6",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:11,fontWeight:700,color:isCurrent?"#fff":isPast?"#fff":"#8B95A1"}}>{r}</span>
                </div>
                <div style={{flex:1}}>
                  {isCurrent?(<><div style={{fontSize:13,fontWeight:700,color:"#191F28"}}>복무 중 · {rankInfo.hobon}호봉</div>{!isLast&&nextDate&&<div style={{fontSize:11,color:"#3182F6",marginTop:2,fontWeight:600}}>{fmtDate(nextDate)} {RANK_LABELS[i+1]} 진급 예정 · D-{dLeft}</div>}{isLast&&<div style={{fontSize:11,color:"#F04452",marginTop:2,fontWeight:600}}>{fmtDate(profile.discharge)} 전역 예정 · D-{Math.max(0,diffDays(today,profile.discharge))}</div>}</>)
                  :isPast?(<><div style={{fontSize:13,color:"#4E5968"}}>진급 완료</div><div style={{fontSize:11,color:"#B0B8C1",marginTop:1}}>{fmtDate(startDate)} 시작</div></>)
                  :(<><div style={{fontSize:13,color:"#4E5968"}}>{fmtDate(startDate)} 진급 예정</div><div style={{fontSize:11,color:"#B0B8C1",marginTop:1}}>D-{Math.max(0,diffDays(today,startDate||""))}일 후</div></>)}
                </div>
                {isCurrent&&<div style={{fontSize:10,background:"#EBF3FF",color:"#3182F6",borderRadius:5,padding:"2px 8px",fontWeight:700,flexShrink:0}}>현재</div>}
                {isPast&&<div style={{fontSize:10,background:"#F2F4F6",color:"#B0B8C1",borderRadius:5,padding:"2px 8px",fontWeight:600,flexShrink:0}}>완료</div>}
              </div>
            );
          })}
        </div>
      )}

      <div style={S.card}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>기본 정보</div>
        {[
          {l:"이름",v:profile.name},{l:"유형",v:isGomshin?"곰신 💝":"군화 🪖"},
          {l:isGomshin?"군화 입대일":"입대일",v:profile.enlist},
          {l:isGomshin?"군화 전역일":"전역일",v:profile.discharge},
          !isGomshin&&profile.perf_first_start&&{l:"첫 성과제",v:profile.perf_first_start},
          !isGomshin&&profile.perf_cycle_weeks&&{l:"성과제 주기",v:`${profile.perf_cycle_weeks}주 (${profile.perf_cycle_days}일)`},
          !isGomshin&&profile.visitOutCycle&&{l:"🚗 면회외출 텀",v:`${profile.visitOutCycle}주마다`},
          !isGomshin&&{l:"포상 한도",v:`${profile.reward_limit}일`},
        ].filter(Boolean).map((r,i,arr)=>(
          <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:i<arr.length-1?"1px solid #F2F4F6":"none"}}>
            <span style={{fontSize:13,color:"#8B95A1",fontWeight:500}}>{r.l}</span>
            <span style={{fontSize:13,color:"#191F28",fontWeight:700}}>{r.v}</span>
          </div>
        ))}
        {!isGomshin&&<PerfSetupInline profile={profile} setProfile={setProfile}/>}
        {!isGomshin&&<VisitOutSetupInline profile={profile} setProfile={setProfile}/>}
        {!isGomshin&&<AnnualLimitSetupInline profile={profile} setProfile={setProfile} rankInfo={rankInfo}/>}
      </div>

      <ServiceTimeline profile={profile} rankInfo={rankInfo} leaves={leaves}/>
      {!isGomshin&&<SalaryCalc rankInfo={rankInfo} profile={profile}/>}
      <DdayShareCard profile={profile} rankInfo={rankInfo}/>

      <div style={{display:"flex",gap:8,marginTop:8,justifyContent:"center"}}>
        <button onClick={async()=>{
          await supabase.auth.signOut();
          setProfile(null);setLeaves([]);setSchedules([]);setNotifs([]);setFriends([]);
          setAuthState("no_user");
        }} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #E8ECF0",background:"#F9FAFB",fontSize:11,fontWeight:500,color:"#8B95A1",cursor:"pointer"}}>
          로그아웃
        </button>
        <button onClick={()=>{if(window.confirm("처음부터 다시 설정할까요?\n(등록된 휴가도 모두 삭제됩니다)"))onReset();}} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #E8ECF0",background:"#F9FAFB",fontSize:11,fontWeight:500,color:"#8B95A1",cursor:"pointer"}}>
          초기화
        </button>
        <button onClick={()=>{
          const input=window.prompt("탈퇴하려면 '탈퇴하겠습니다'를 입력하세요");
          if(input==="탈퇴하겠습니다"){onReset();supabase.auth.signOut();}
        }} style={{padding:"4px 10px",borderRadius:8,border:"1px solid #FFD0D0",background:"#FFF0F1",fontSize:11,fontWeight:500,color:"#F04452",cursor:"pointer"}}>
          회원탈퇴
        </button>
      </div>

      <div style={{textAlign:"center",fontSize:11,color:"#D1D6DB"}}>휴곰 v1.3 · {isGomshin?"곰신 모드":"군화 모드"}</div>

      {showRankEdit&&(
        <div className="fi" style={S.overlay} onClick={()=>setShowRankEdit(false)}>
          <div className="su" style={S.sheet} onClick={e=>e.stopPropagation()}>
            <div style={S.handle}/>
            <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>진급 설정 수정</div>
            <div style={{fontSize:12,color:"#8B95A1",marginBottom:18}}>늦게 진급한 계급의 개월 수를 입력해요</div>
            <div style={{background:"#F9FAFB",borderRadius:14,padding:"12px 16px",marginBottom:20,border:"1px solid #E8ECF0"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#333D4B",marginBottom:10}}>진급누락 개월 수</div>
              {["이등병","일병","상병"].map(r=>(<div key={r} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{width:48,height:28,borderRadius:7,background:"#E8ECF0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:11,fontWeight:700,color:"#8B95A1"}}>{r}</span></div><input style={{...S.input,flex:1,height:38,padding:"6px 12px",fontSize:14}} type="number" min="0" max="24" value={editMissed[r]||""} onChange={e=>setEditMissed(p=>({...p,[r]:parseInt(e.target.value)||0}))} placeholder="0"/><span style={{fontSize:12,color:"#8B95A1",flexShrink:0}}>개월</span></div>))}
            </div>
            {(()=>{try{const preview=calcRankInfo(profile.enlist,editMissed);return(<div style={{background:"#EBF3FF",borderRadius:12,padding:"12px 14px",marginBottom:16,border:"1px solid #A5C9FF"}}><div style={{fontSize:11,fontWeight:700,color:"#3182F6",marginBottom:8}}>변경 후 진급 예정일</div>{["이등병","일병","상병"].map(r=>(<div key={r} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",color:"#4E5968"}}><span>{r} → {RANK_LABELS[RANK_LABELS.indexOf(r)+1]}</span><span style={{fontWeight:700,color:"#191F28"}}>{fmtDate(preview.promotions[r])}</span></div>))}</div>);}catch{return null;}})()}
            <button style={{...S.btn,background:"#3182F6",color:"#fff",boxShadow:"0 4px 14px rgba(49,130,246,.28)"}} onClick={saveRankEdit}>저장</button>
          </div>
        </div>
      )}
    </div>
  );
}
function PerfSetupInline({profile,setProfile}){
  const [open,setOpen]=useState(false);
  const [perfFirst,setPerfFirst]=useState(profile.perf_first_start||"");
  const [cycleW,setCycleW]=useState(profile.perf_cycle_weeks||null);
  const [cycleD,setCycleD]=useState(profile.perf_cycle_days||null);
  const cycleOpts=[{w:6,d:3,label:"6주",desc:"2박 3일"},{w:8,d:4,label:"8주",desc:"3박 4일"},{w:12,d:5,label:"12주",desc:"4박 5일"}];
  const save=()=>{if(!perfFirst||!cycleW)return;setProfile(p=>({...p,perf_first_start:perfFirst,perf_cycle_weeks:cycleW,perf_cycle_days:cycleD}));setOpen(false);};
  if(!open) return(
    <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #F2F4F6"}}>
      {profile.perf_first_start
        ?<button onClick={()=>setOpen(true)} style={{width:"100%",padding:"8px",background:"#EBF3FF",color:"#3182F6",borderRadius:10,border:"1px solid #A5C9FF",fontSize:13,fontWeight:700,cursor:"pointer"}}>⭐ 외박 수정 (공군 성과제)</button>
        :<><div style={{fontSize:12,color:"#B0B8C1",marginBottom:8}}>외박 일정이 미설정이에요</div><button onClick={()=>setOpen(true)} style={{width:"100%",padding:"8px",background:"#EBF3FF",color:"#3182F6",borderRadius:10,border:"1px solid #A5C9FF",fontSize:13,fontWeight:700,cursor:"pointer"}}>⭐ 외박 설정하기 (공군 성과제)</button></>
      }
    </div>
  );
  return(
    <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #F2F4F6"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#191F28",marginBottom:12}}>⭐ 외박 설정</div>
      <div style={{marginBottom:10}}><div style={{fontSize:12,color:"#8B95A1",marginBottom:5}}>첫 외박 시작일</div><input style={S.input} type="date" value={perfFirst} onChange={e=>setPerfFirst(e.target.value)}/></div>
      <div style={{marginBottom:12}}><div style={{fontSize:12,color:"#8B95A1",marginBottom:5}}>주기</div><div style={{display:"flex",gap:6}}>{cycleOpts.map(o=>(<button key={o.w} onClick={()=>{setCycleW(o.w);setCycleD(o.d);}} style={{flex:1,padding:"8px 4px",borderRadius:10,border:`2px solid ${cycleW===o.w?"#3182F6":"#E8ECF0"}`,background:cycleW===o.w?"#EBF3FF":"#F9FAFB",cursor:"pointer",fontSize:12,fontWeight:700,color:cycleW===o.w?"#3182F6":"#4E5968"}}>{o.label}<br/><span style={{fontSize:10,fontWeight:400,color:"#8B95A1"}}>{o.desc}</span></button>))}</div></div>
      <div style={{display:"flex",gap:8}}><button onClick={()=>setOpen(false)} style={{flex:1,padding:10,borderRadius:10,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:13,fontWeight:600,color:"#8B95A1",cursor:"pointer"}}>취소</button><button onClick={save} disabled={!perfFirst||!cycleW} style={{flex:2,padding:10,borderRadius:10,border:"none",background:perfFirst&&cycleW?"#3182F6":"#E8ECF0",color:perfFirst&&cycleW?"#fff":"#B0B8C1",fontSize:13,fontWeight:700,cursor:perfFirst&&cycleW?"pointer":"default"}}>저장</button></div>
    </div>
  );
}

function VisitOutSetupInline({profile,setProfile}){
  const [open,setOpen]=useState(false);
  const [inputVal,setInputVal]=useState(String(profile.visitOutCycle||""));
  const save=()=>{const val=inputVal?parseInt(inputVal):null;setProfile(p=>({...p,visitOutCycle:val}));setOpen(false);};
  if(!open) return(
    <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #F2F4F6"}}>
      <div style={{fontSize:12,color:"#8B95A1",marginBottom:8}}>🚗 면회외출 텀: <span style={{fontWeight:700,color:profile.visitOutCycle?"#7C3AED":"#B0B8C1"}}>{profile.visitOutCycle?`${profile.visitOutCycle}주마다`:"미설정"}</span></div>
      <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"8px",background:"#F3EEFF",color:"#7C3AED",borderRadius:10,border:"1px solid #C9B2F8",fontSize:13,fontWeight:700,cursor:"pointer"}}>🚗 면회외출 텀 {profile.visitOutCycle?"수정":"설정"}하기</button>
    </div>
  );
  return(
    <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #F2F4F6"}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>🚗 면회외출 텀 (주 단위)</div>
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
        {[{w:1,label:"매주"},{w:4,label:"4주"},{w:8,label:"8주"},{w:13,label:"3개월"}].map(o=>(<button key={o.w} onClick={()=>setInputVal(String(o.w))} style={{padding:"7px 12px",borderRadius:10,border:`1.5px solid ${parseInt(inputVal)===o.w?"#7C3AED":"#E8ECF0"}`,background:parseInt(inputVal)===o.w?"#7C3AED":"#F9FAFB",fontSize:12,fontWeight:700,color:parseInt(inputVal)===o.w?"#fff":"#8B95A1",cursor:"pointer"}}>{o.label}</button>))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><input style={{...S.input,flex:1,textAlign:"center",fontWeight:700}} type="number" min="1" max="52" value={inputVal} onChange={e=>setInputVal(e.target.value)} placeholder="직접 입력"/><span style={{fontSize:13,color:"#8B95A1",flexShrink:0}}>주마다</span></div>
      <div style={{display:"flex",gap:8}}><button onClick={()=>setOpen(false)} style={{flex:1,padding:10,borderRadius:10,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:13,fontWeight:600,color:"#8B95A1",cursor:"pointer"}}>취소</button><button onClick={save} style={{flex:2,padding:10,borderRadius:10,border:"none",background:"#7C3AED",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>저장</button></div>
    </div>
  );
}

function AnnualLimitSetupInline({profile,setProfile,rankInfo}){
  const [open,setOpen]=useState(false);
  const [limits,setLimits]=useState({...(profile.annual_limits||{이등병:null,일병:null,상병:null,병장:null})});
  const [rewardLim,setRewardLim]=useState(String(profile.reward_limit||6));
  const save=()=>{
    const parsed={};
    RANK_LABELS.forEach(r=>{parsed[r]=limits[r]?parseInt(limits[r]):null;});
    setProfile(p=>({...p,annual_limits:parsed,reward_limit:parseInt(rewardLim)||6}));
    setOpen(false);
  };
  const hasLimits=Object.values(profile.annual_limits||{}).some(v=>v);
  if(!open) return(
    <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #F2F4F6"}}>
      <div style={{fontSize:12,color:"#8B95A1",marginBottom:8}}>🌿 연가·포상 한도 (초과 시 경고)</div>
      <button onClick={()=>setOpen(true)} style={{width:"100%",padding:"8px",background:"#E8FBF3",color:"#05C072",borderRadius:10,border:"1px solid #B7F0D5",fontSize:13,fontWeight:700,cursor:"pointer"}}>🌿 연가·포상 한도 {hasLimits?"수정":"설정"}하기</button>
    </div>
  );
  return(
    <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid #F2F4F6"}}>
      <div style={{fontSize:13,fontWeight:700,color:"#191F28",marginBottom:12}}>🌿 계급별 연가 한도 설정</div>
      {RANK_LABELS.map(r=>{
        const isCurrent=rankInfo?.currentRank===r;
        return(<div key={r} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <div style={{width:52,height:30,borderRadius:8,background:isCurrent?"#3182F6":"#E8ECF0",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:11,fontWeight:700,color:isCurrent?"#fff":"#8B95A1"}}>{r}</span></div>
          <input style={{...S.input,flex:1,height:38,padding:"8px 12px",fontSize:14}} type="number" min="0" max="30" value={limits[r]||""} onChange={e=>setLimits(prev=>({...prev,[r]:e.target.value}))} placeholder={r==="이등병"?"2":r==="일병"?"10":"8"}/>
          <span style={{fontSize:12,color:"#8B95A1",flexShrink:0}}>일</span>
        </div>);
      })}
      <div style={{marginTop:10,marginBottom:12}}>
        <div style={{fontSize:12,color:"#8B95A1",marginBottom:6}}>🏅 포상휴가 한도</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}><input style={{...S.input,flex:1,height:38,padding:"8px 12px",fontSize:14}} type="number" value={rewardLim} onChange={e=>setRewardLim(e.target.value)} placeholder="6"/><span style={{fontSize:12,color:"#8B95A1",flexShrink:0}}>일</span></div>
      </div>
      <div style={{display:"flex",gap:8}}><button onClick={()=>setOpen(false)} style={{flex:1,padding:10,borderRadius:10,border:"1.5px solid #E8ECF0",background:"#fff",fontSize:13,fontWeight:600,color:"#8B95A1",cursor:"pointer"}}>취소</button><button onClick={save} style={{flex:2,padding:10,borderRadius:10,border:"none",background:"#05C072",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>저장</button></div>
    </div>
  );
}

function ServiceTimeline({profile,rankInfo,leaves}){
  const [open,setOpen]=useState(false);
  const today=toKey(new Date());
  const isGomshin=profile.userType==="gomshin";
  const events=useMemo(()=>{
    const list=[];
    list.push({date:profile.enlist,label:"입대",icon:"🪖",color:"#3182F6",type:"major"});
    list.push({date:addDays(profile.enlist,41),label:"훈련소 수료",icon:"🎓",color:"#7C3AED",type:"major"});
    if(!isGomshin&&rankInfo){
      [{key:"이등병",label:"일병 진급",color:"#05C072"},{key:"일병",label:"상병 진급",color:"#05C072"},{key:"상병",label:"병장 진급",color:"#FFD700"}].forEach(({key,label,color})=>{
        if(rankInfo.promotions[key]) list.push({date:rankInfo.promotions[key],label,icon:"⬆️",color,type:"rank"});
      });
    }
    leaves.slice(0,5).forEach(l=>{const lt=LEAVE_TYPES[l.leave_type];if(lt)list.push({date:l.start_date,label:`${lt.label} (${diffDays(l.start_date,l.end_date)+1}일)`,icon:lt.icon,color:lt.color,type:"leave"});});
    list.push({date:profile.discharge,label:"전역 🎉",icon:"🏠",color:"#F04452",type:"major"});
    return list.sort((a,b)=>a.date.localeCompare(b.date));
  },[profile,rankInfo,leaves,isGomshin]);
  const total=diffDays(profile.enlist,profile.discharge);
  const served=Math.max(0,diffDays(profile.enlist,today));
  const pct=Math.min(100,(served/total)*100);
  return(
    <div style={S.card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:700}}>🗓 복무 타임라인</div>
        <button onClick={()=>setOpen(o=>!o)} style={{fontSize:12,color:"#3182F6",fontWeight:700,background:"#EBF3FF",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>{open?"접기":"펼치기"}</button>
      </div>
      <div style={{marginBottom:open?16:0}}>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#8B95A1",marginBottom:5}}><span>{profile.enlist}</span><span style={{color:"#3182F6",fontWeight:700}}>{pct.toFixed(1)}% 완료</span><span>{profile.discharge}</span></div>
        <div style={{height:8,background:"#F2F4F6",borderRadius:4,overflow:"hidden",position:"relative"}}>
          <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#3182F6,#5BA4FF)",borderRadius:4}}/>
          <div style={{position:"absolute",top:"50%",left:`${pct}%`,transform:"translate(-50%,-50%)",width:12,height:12,borderRadius:"50%",background:"#3182F6",border:"2px solid #fff",boxShadow:"0 0 0 2px #3182F6"}}/>
        </div>
      </div>
      {open&&(
        <div style={{position:"relative",paddingLeft:24}}>
          <div style={{position:"absolute",left:7,top:8,bottom:8,width:2,background:"#E8ECF0",borderRadius:1}}/>
          {events.map((ev,i)=>{const isPast=ev.date<=today,isNow=ev.date===today;return(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:14,position:"relative"}}>
              <div style={{width:16,height:16,borderRadius:"50%",background:isPast?ev.color:"#E8ECF0",border:`2px solid ${isPast?ev.color:"#D1D6DB"}`,flexShrink:0,marginTop:2,zIndex:1,position:"relative",left:-23,marginRight:-7,boxShadow:isNow?`0 0 0 3px ${ev.color}44`:isPast&&ev.type==="major"?`0 0 0 2px ${ev.color}33`:"none"}}/>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:1}}><span style={{fontSize:14}}>{ev.icon}</span><span style={{fontSize:13,fontWeight:ev.type==="major"?700:500,color:isPast?"#191F28":"#B0B8C1"}}>{ev.label}</span>{isNow&&<span style={{fontSize:9,background:"#3182F6",color:"#fff",borderRadius:4,padding:"1px 5px",fontWeight:700}}>TODAY</span>}</div>
                <div style={{fontSize:11,color:isPast?"#8B95A1":"#B0B8C1"}}>{fmtDate(ev.date)}{ev.date>today?` · D-${diffDays(today,ev.date)}`:" · 완료"}</div>
              </div>
            </div>
          );})}
        </div>
      )}
    </div>
  );
}
function SalaryCalc({rankInfo, profile}){
  const [open, setOpen] = useState(false);
  const [durations, setDurations] = useState({ 이등병: 2, 일병: 6, 상병: 6, 병장: 4 });
  
  const totalSalary = useMemo(() => {
    let total = 0;
    RANK_LABELS.forEach(r => {
      total += (SOLDIER_PAY[r] || 0) * (durations[r] || 0);
    });
    return total;
  }, [durations]);

  const totalSavings = useMemo(() => {
    const months = Object.values(durations).reduce((a, b) => a + b, 0);
    return (totalSalary + (NAEILJUN_MAX * months)) * 1.05;
  }, [totalSalary, durations]);

  if (!open) return (
    <div style={S.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:14,fontWeight:700}}>💰 예상 전역 적금</div>
          <div style={{fontSize:18,fontWeight:900,color:"#3182F6",marginTop:4}}>약 {Math.round(totalSavings/10000).toLocaleString()}만원</div>
        </div>
        <button onClick={()=>setOpen(true)} style={{fontSize:12,color:"#3182F6",fontWeight:700,background:"#EBF3FF",border:"none",borderRadius:8,padding:"8px 12px",cursor:"pointer"}}>기간 설정</button>
      </div>
    </div>
  );

  return (
    <div className="fi" style={S.overlay} onClick={()=>setOpen(false)}>
      <div className="su" style={S.sheet} onClick={e=>e.stopPropagation()}>
        <div style={S.handle}/>
        <div style={{fontSize:16,fontWeight:800,marginBottom:18}}>계급별 복무 기간 설정</div>
        <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
          {RANK_LABELS.map(r => (
            <div key={r} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:14,fontWeight:600,color:"#4E5968"}}>{r}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input 
                  type="number" 
                  value={durations[r]} 
                  onChange={e => setDurations(prev => ({...prev, [r]: parseInt(e.target.value) || 0}))}
                  style={{...S.input, width:60, textAlign:"center", padding:"8px"}}
                />
                <span style={{fontSize:13,color:"#8B95A1"}}>개월</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{background:"#F9FAFB",borderRadius:12,padding:"14px",marginBottom:20}}>
          <div style={{fontSize:12,color:"#8B95A1",marginBottom:4}}>예상 총 수령액 (월급+내일준비적금)</div>
          <div style={{fontSize:20,fontWeight:900,color:"#191F28"}}>{fmtMan(Math.round(totalSavings))}</div>
        </div>
        <button style={{...S.btn,background:"#3182F6",color:"#fff"}} onClick={()=>setOpen(false)}>확인</button>
      </div>
    </div>
  );
}

const CARD_THEMES={
  army:{bg:"linear-gradient(145deg,#3D5A1E 0%,#556B2F 50%,#8FA47A 100%)",label:"🪖 군인 테마",dot1:"rgba(255,255,255,.08)",dot2:"rgba(0,0,0,.12)"},
  pink:{bg:"linear-gradient(145deg,#FF4081 0%,#E91E8C 50%,#C2185B 100%)",label:"💝 곰신 테마",dot1:"rgba(255,255,255,.1)",dot2:"rgba(0,0,0,.08)"},
  dark:{bg:"linear-gradient(145deg,#1A1A2E 0%,#16213E 50%,#0F3460 100%)",label:"🌙 다크 테마",dot1:"rgba(255,215,0,.08)",dot2:"rgba(0,0,0,.2)"},
};

function DdayShareCard({profile,rankInfo}){
  const [open,setOpen]=useState(false);const [copied,setCopied]=useState(false);const [cardStyle,setCardStyle]=useState("army");
  const today=toKey(new Date());const left=Math.max(0,diffDays(today,profile.discharge));const total=diffDays(profile.enlist,profile.discharge);const served=Math.max(0,Math.min(total,diffDays(profile.enlist,today)));const pct=Math.min(100,Math.round((served/total)*100));
  const isGomshin=profile.userType==="gomshin";const rank=rankInfo?.currentRank||"";const hobon=rankInfo?.hobon||"";const theme=CARD_THEMES[cardStyle];
  const generateImage=()=>{
    const canvas=document.createElement("canvas");canvas.width=900;canvas.height=1100;const ctx=canvas.getContext("2d");
    const grad=ctx.createLinearGradient(0,0,900,1100);const colors={army:["#3D5A1E","#556B2F","#8FA47A"],pink:["#FF4081","#E91E8C","#C2185B"],dark:["#1A1A2E","#16213E","#0F3460"]}[cardStyle];
    grad.addColorStop(0,colors[0]);grad.addColorStop(.5,colors[1]);grad.addColorStop(1,colors[2]);ctx.fillStyle=grad;ctx.fillRect(0,0,900,1100);
    ctx.fillStyle="rgba(255,255,255,0.05)";ctx.beginPath();ctx.arc(750,150,260,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(-50,950,200,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.9)";ctx.font="bold 32px sans-serif";ctx.textAlign="left";ctx.fillText("🐻 휴곰",80,105);
    ctx.fillStyle="rgba(255,255,255,0.55)";ctx.font="22px sans-serif";ctx.fillText("군인과 곰신의 휴가 관리 서비스",80,145);
    ctx.fillStyle="#fff";ctx.font="bold 52px sans-serif";ctx.fillText(profile.name+(isGomshin?" 곰신":""),80,240);
    if(!isGomshin&&rank){ctx.fillStyle="rgba(255,255,255,0.7)";ctx.font="bold 30px sans-serif";ctx.fillText(`${rank} ${hobon}호봉 · 공군`,80,285);}
    ctx.strokeStyle="rgba(255,255,255,0.2)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(80,310);ctx.lineTo(820,310);ctx.stroke();
    ctx.font="180px serif";ctx.textAlign="center";ctx.fillStyle="#fff";ctx.fillText(isGomshin?"🧸":"🐻",720,520);
    ctx.fillStyle="rgba(255,255,255,0.2)";ctx.font="bold 240px sans-serif";ctx.textAlign="left";ctx.fillText("D-",60,590);
    ctx.fillStyle="#fff";ctx.font="bold 220px sans-serif";ctx.fillText(String(left),220,590);
    ctx.fillStyle="rgba(255,255,255,0.18)";ctx.beginPath();ctx.roundRect(60,620,420,64,16);ctx.fill();
    ctx.fillStyle="#fff";ctx.font="bold 28px sans-serif";ctx.textAlign="center";ctx.fillText(`📅 ${profile.discharge} 전역예정`,270,662);
    ctx.fillStyle="rgba(255,255,255,0.15)";ctx.beginPath();ctx.roundRect(60,720,780,90,20);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.9)";ctx.font="bold 24px sans-serif";ctx.textAlign="left";ctx.fillText(`복무 ${pct}% 완료 (${served}일 / ${total}일)`,80,775);
    ctx.fillStyle="rgba(255,255,255,0.2)";ctx.beginPath();ctx.roundRect(60,800,780,16,8);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.85)";ctx.beginPath();ctx.roundRect(60,800,Math.max(16,780*(pct/100)),16,8);ctx.fill();
    ctx.fillStyle="#FFD700";ctx.beginPath();ctx.arc(60+780*(pct/100),808,10,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="rgba(255,255,255,0.4)";ctx.font="20px sans-serif";ctx.textAlign="center";ctx.fillText("#휴곰 #군복무 #전역카운트",450,900);
    ctx.fillStyle="rgba(255,255,255,0.3)";ctx.font="18px sans-serif";ctx.textAlign="right";ctx.fillText(today+" 기준 · 휴곰 앱",840,960);
    return canvas.toDataURL("image/png");
  };
  const handleDownload=()=>{const url=generateImage();const a=document.createElement("a");a.href=url;a.download=`휴곰_${profile.name}_D${left}.png`;a.click();};
  const handleCopyText=()=>{const msg=`🐻🪖 ${profile.name} ${rank||""}\n전역 D-${left}\n${profile.discharge} 전역예정\n복무 ${pct}% (${served}/${total}일)\n\n#휴곰 #군복무 #전역카운트`;navigator.clipboard?.writeText(msg).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});};
  return(
    <div style={S.card}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:open?14:0}}>
        <div><div style={{fontSize:14,fontWeight:700}}>📤 전역 D-day 카드</div>{!open&&<div style={{fontSize:12,color:"#8B95A1",marginTop:2}}>예쁜 이미지로 카카오·인스타 공유</div>}</div>
        <button onClick={()=>setOpen(o=>!o)} style={{fontSize:12,color:"#556B2F",fontWeight:700,background:"#F2E7D5",border:"none",borderRadius:8,padding:"5px 10px",cursor:"pointer"}}>{open?"접기":"만들기 🐻"}</button>
      </div>
      {open&&(
        <div>
          <div style={{display:"flex",gap:7,marginBottom:14}}>
            {Object.entries(CARD_THEMES).map(([key,t])=>(<button key={key} onClick={()=>setCardStyle(key)} style={{flex:1,padding:"8px 4px",borderRadius:10,border:`2px solid ${cardStyle===key?"#556B2F":"#E8ECF0"}`,background:cardStyle===key?"#556B2F":"#F9FAFB",fontSize:11,fontWeight:700,color:cardStyle===key?"#fff":"#8B95A1",cursor:"pointer"}}>{t.label}</button>))}
          </div>
          <div style={{background:theme.bg,borderRadius:22,padding:"22px 20px 20px",marginBottom:14,position:"relative",overflow:"hidden",boxShadow:"0 8px 32px rgba(0,0,0,.25)"}}>
            <div style={{position:"absolute",top:-40,right:-40,width:160,height:160,borderRadius:"50%",background:theme.dot1}}/>
            <div style={{position:"absolute",bottom:-30,left:-20,width:100,height:100,borderRadius:"50%",background:theme.dot2}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,position:"relative"}}>
              <div><div style={{fontSize:12,color:"rgba(255,255,255,.6)",fontWeight:600}}>🐻 휴곰</div><div style={{fontSize:18,fontWeight:900,color:"#fff",marginTop:2}}>{profile.name}{isGomshin?" 곰신":""}</div>{!isGomshin&&rank&&<div style={{fontSize:12,color:"rgba(255,255,255,.7)",marginTop:1}}>{rank} {hobon}호봉</div>}</div>
              <div style={{fontSize:52,lineHeight:1}}>{isGomshin?"🧸":"🐻"}</div>
            </div>
            <div style={{height:1,background:"rgba(255,255,255,.2)",marginBottom:14}}/>
            <div style={{display:"flex",alignItems:"flex-end",gap:4,marginBottom:6}}><div style={{fontSize:13,color:"rgba(255,255,255,.6)",fontWeight:700,marginBottom:8}}>전역까지</div><div style={{fontSize:72,fontWeight:900,color:"#fff",lineHeight:1,letterSpacing:-2}}>D-{left}</div></div>
            <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.18)",borderRadius:100,padding:"5px 14px",marginBottom:14}}><span style={{fontSize:12}}>📅</span><span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{profile.discharge} 전역예정</span></div>
            <div style={{background:"rgba(255,255,255,.12)",borderRadius:12,padding:"10px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}><span style={{fontSize:11,color:"rgba(255,255,255,.65)",fontWeight:600}}>복무 진행률</span><span style={{fontSize:11,color:"#fff",fontWeight:800}}>{pct}%</span></div>
              <div style={{height:7,background:"rgba(255,255,255,.2)",borderRadius:4,position:"relative"}}><div style={{height:"100%",width:`${pct}%`,background:"rgba(255,255,255,.85)",borderRadius:4}}/><div style={{position:"absolute",top:"50%",left:`${pct}%`,transform:"translate(-50%,-50%)",width:13,height:13,borderRadius:"50%",background:"#FFD700",boxShadow:"0 0 6px rgba(255,215,0,.8)"}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}><span style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{profile.enlist}</span><span style={{fontSize:10,color:"rgba(255,255,255,.6)",fontWeight:600}}>{served}일 / {total}일</span><span style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{profile.discharge}</span></div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:8}}>
            <button onClick={handleDownload} style={{flex:1,padding:"13px 8px",background:"linear-gradient(135deg,#3D5A1E,#556B2F)",color:"#fff",borderRadius:12,border:"none",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><span>💾</span><span>이미지 저장</span></button>
            <button onClick={handleCopyText} style={{flex:1,padding:"13px 8px",background:copied?"#05C072":"#F2F4F6",color:copied?"#fff":"#4E5968",borderRadius:12,border:"none",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><span>{copied?"✓":"📋"}</span><span>{copied?"복사됨":"텍스트 복사"}</span></button>
          </div>
          <div style={{textAlign:"center",fontSize:11,color:"#B0B8C1"}}>🐻 이미지 저장 후 카카오톡·인스타그램에 공유해보세요!</div>
        </div>
      )}
    </div>
  );
}
// Build trigger: Sun Jun 28 16:44:48 UTC 2026
