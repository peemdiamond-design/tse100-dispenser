import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, serverTimestamp, doc, setDoc, getDoc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { CONFIG, DICT } from "./config.js";

let currentLang = localStorage.getItem('tu_rx_lang') || 'th';
function t(key) { return DICT[currentLang][key] || key; }

window.toggleLanguage = function() {
    currentLang = currentLang === 'th' ? 'en' : 'th';
    localStorage.setItem('tu_rx_lang', currentLang);
    applyLanguage();
}

function applyLanguage() {
    document.getElementById('langBtn').innerText = currentLang === 'th' ? '🇹🇭' : '🇬🇧';
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (DICT[currentLang][key]) el.innerText = DICT[currentLang][key];
    });
    document.getElementById('stuIdInput').placeholder = t('ph_stu_id');
    document.getElementById('pwdInput').placeholder = t('ph_pwd');
    
    let mqttTxt = document.getElementById('mqtt-status-text').innerText;
    if(mqttTxt === "ระบบ Online" || mqttTxt === "System Online") document.getElementById('mqtt-status-text').innerText = t('admin_online');
    else document.getElementById('mqtt-status-text').innerText = t('admin_offline');

    renderProducts();
    updateCartUI();
    if(auth.currentUser) {
        const stuId = auth.currentUser.email.split('@')[0];
        if(stuId !== CONFIG.ADMIN_ID) loadOrders(stuId);
    }
}

document.addEventListener("DOMContentLoaded", applyLanguage);

let deferredPrompt;
const installBtn = document.getElementById('btnInstallApp');
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

if (isIOS && !isStandalone) {
    if (installBtn) {
        installBtn.style.display = 'block';
        installBtn.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i> กดแชร์ด้านล่าง แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"';
        installBtn.style.pointerEvents = 'none'; 
        installBtn.style.background = '#f8f9fa';
        installBtn.style.color = '#6c757d';
        installBtn.style.borderColor = '#dee2e6';
    }
} else {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (installBtn) {
            installBtn.style.display = 'block';
            installBtn.innerHTML = `<i class="fa-solid fa-mobile-screen"></i> <span data-i18n="btn_install">${t('btn_install')}</span>`;
        }
    });
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') installBtn.style.display = 'none';
                deferredPrompt = null;
            }
        });
    }
}

window.showPrivacyPolicy = function() {
    let title = currentLang === 'th' ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy';
    let desc = currentLang === 'th' ? 'ข้อมูลประวัติการสั่งซื้อและรหัสนักศึกษาของคุณ จะถูกเก็บรักษาเป็นความลับเพื่อใช้สำหรับการให้บริการตู้จ่ายยาอัตโนมัติเท่านั้น' : 'Your purchase history and student ID are kept strictly confidential and used only for operating this smart pharmacy.';
    Swal.fire(title, desc, 'info');
}

const btnReportIssue = document.getElementById('btnReportIssue');
if (btnReportIssue) {
    btnReportIssue.addEventListener('click', () => {
        let title = currentLang === 'th' ? 'แจ้งปัญหาตู้ขัดข้อง' : 'Report an Issue';
        let desc = currentLang === 'th' ? 'กรุณาติดต่อ Line OA: <b>@TSE_SmartRx</b><br>หรือ โทร <b>08X-XXX-XXXX</b><br><br><span style="font-size:13px; color:#c51d23;"><i>* โปรดเตรียมภาพสลิปโอนเงินเพื่อขอคืนเงิน</i></span>' : 'Please contact Line OA: <b>@TSE_SmartRx</b><br>or Call <b>08X-XXX-XXXX</b><br><br><span style="font-size:13px; color:#c51d23;"><i>* Please prepare your payment slip for refunds</i></span>';
        Swal.fire({ icon: 'warning', title: title, html: desc, confirmButtonColor: 'var(--tu-red)' });
    });
}

const app = initializeApp(CONFIG.FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const mqttClient = mqtt.connect(CONFIG.MQTT_BROKER);
const mqttBadge = document.getElementById('mqtt-status-badge');

mqttClient.on('connect', () => {
    mqttBadge.className = 'badge-status status-online';
    document.getElementById('mqtt-status-text').innerText = t('admin_online');
});
mqttClient.on('offline', () => {
    mqttBadge.className = 'badge-status status-offline';
    document.getElementById('mqtt-status-text').innerText = t('admin_offline');
});
mqttClient.on('error', () => {
    mqttBadge.className = 'badge-status status-offline';
    document.getElementById('mqtt-status-text').innerText = t('admin_offline');
});

let inventory = []; 
let cart = [];
let adminGlobalOrdersData = [];

const defaultEngData = {
    'p1': { nameEn: 'Paracetamol 500mg', descEn: '10 tablets/pack', propsEn: 'Relieves pain and reduces fever', warnEn: 'Do not use if you have severe liver disease' },
    'p2': { nameEn: 'Activated Charcoal', descEn: '10 capsules/pack', propsEn: 'Relieves diarrhea and food poisoning', warnEn: 'Take 2 hours apart from other meds' },
    'p3': { nameEn: 'Medical Plaster (5 pcs)', descEn: 'Prevents wound infection', propsEn: 'Covers and protects wounds', warnEn: 'Beware of adhesive allergies' },
    'p4': { nameEn: 'Poy-Sian Inhaler', descEn: '1 tube', propsEn: 'Relieves dizziness and nasal congestion', warnEn: 'For external use only. Do not swallow' }
};

const invRef = collection(db, "inventory");
onSnapshot(invRef, (snapshot) => {
    if (snapshot.empty) {
        initializeDefaultInventory();
    } else {
        inventory = [];
        snapshot.forEach(docSnap => {
            let d = docSnap.data();
            if (!d.nameEn && defaultEngData[docSnap.id]) {
                updateDoc(doc(db, "inventory", docSnap.id), defaultEngData[docSnap.id]);
                d = { ...d, ...defaultEngData[docSnap.id] };
            }
            inventory.push({ id: docSnap.id, ...d });
        });
        inventory.sort((a, b) => a.id.localeCompare(b.id));
        document.getElementById('loading-inventory').style.display = 'none';
        renderProducts();
        updateCartUI(); 
    }
});

async function initializeDefaultInventory() {
    const defaultItems = [
        { id: 'p1', name: 'พาราเซตามอล 500mg', nameEn: 'Paracetamol 500mg', desc: 'แผงละ 10 เม็ด', descEn: '10 tablets/pack', price: 20, stock: 10, img: 'assets/para.jpeg', props: 'บรรเทาอาการปวด ลดไข้', propsEn: 'Relieves pain and reduces fever', warn: 'ห้ามใช้ในผู้ที่เป็นโรคตับรุนแรง', warnEn: 'Do not use if you have severe liver disease' },
        { id: 'p2', name: 'ผงถ่านคาร์บอน', nameEn: 'Activated Charcoal', desc: 'แผงละ 10 เม็ด', descEn: '10 capsules/pack', price: 25, stock: 5, img: 'assets/charcoal.jpeg', props: 'บรรเทาอาการท้องเสีย อาหารเป็นพิษ', propsEn: 'Relieves diarrhea and food poisoning', warn: 'ทานห่างจากยาอื่น 2 ชม.', warnEn: 'Take 2 hours apart from other meds' },
        { id: 'p3', name: 'พลาสเตอร์ยา (5 ชิ้น)', nameEn: 'Medical Plaster (5 pcs)', desc: 'ป้องกันแผลติดเชื้อ', descEn: 'Prevents wound infection', price: 15, stock: 15, img: 'assets/plaster.jpeg', props: 'ปกปิดและป้องกันบาดแผล', propsEn: 'Covers and protects wounds', warn: 'ระวังการแพ้กาวพลาสเตอร์', warnEn: 'Beware of adhesive allergies' },
        { id: 'p4', name: 'ยาดมตราโป๊ยเซียน', nameEn: 'Poy-Sian Inhaler', desc: '1 หลอด', descEn: '1 tube', price: 20, stock: 20, img: 'assets/inhaler.jpeg', props: 'บรรเทาอาการวิงเวียนศีรษะ', propsEn: 'Relieves dizziness and nasal congestion', warn: 'ยาใช้ภายนอก ห้ามรับประทาน', warnEn: 'For external use only. Do not swallow' }
    ];
    for (const item of defaultItems) {
        await setDoc(doc(db, "inventory", item.id), item);
    }
}

window.switchTab = function(viewId, navElement) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(navElement) navElement.classList.add('active');
    
    if(auth.currentUser) {
        const stuId = auth.currentUser.email.split('@')[0];
        if(viewId === 'view-orders' && stuId !== CONFIG.ADMIN_ID) loadOrders(stuId); 
        if(viewId === 'view-admin' && stuId === CONFIG.ADMIN_ID) loadAdminDashboard();
    }
}

window.openCartModal = () => {
    document.getElementById('consent-check').checked = false;
    document.getElementById('cart-modal').style.display = 'flex';
}
window.closeModals = () => {
    document.getElementById('cart-modal').style.display = 'none';
    document.getElementById('payment-modal').style.display = 'none';
}

function renderProducts() {
    const container = document.getElementById('product-list-container');
    container.innerHTML = '';
    if (inventory.length === 0) return;
    
    inventory.forEach(item => {
        const cartItem = cart.find(c => c.id === item.id);
        const qtyInCart = cartItem ? cartItem.qty : 0;
        const isOutOfStock = (item.stock - qtyInCart) <= 0;
        
        let pName = currentLang === 'en' && item.nameEn ? item.nameEn : item.name;
        let pDesc = currentLang === 'en' && item.descEn ? item.descEn : item.desc;
        let pProps = currentLang === 'en' && item.propsEn ? item.propsEn : item.props;
        let pWarn = currentLang === 'en' && item.warnEn ? item.warnEn : item.warn;

        const btnHTML = isOutOfStock 
            ? `<button class="out-of-stock-btn" disabled>${t('out_of_stock')}</button>`
            : `<button class="add-btn" onclick="addToCart('${item.id}')"><i class="fa-solid fa-plus"></i></button>`;

        const badgeHTML = item.stock <= 0 
            ? `<div class="stock-badge" style="background: rgba(0,0,0,0.6); color: white;">${t('out_of_stock')}</div>` 
            : `<div class="stock-badge" style="background: var(--tu-yellow); color: #000; font-weight: 600;">${t('left')} ${item.stock} ${t('pcs')}</div>`;

        container.innerHTML += `
            <div class="product-card" style="opacity: ${item.stock <= 0 ? '0.6' : '1'};">
                ${badgeHTML}
                <img src="${item.img}" style="width: 70px; height: 70px; border-radius: 12px; object-fit: cover;" onerror="this.src='https://cdn-icons-png.flaticon.com/512/822/822102.png'">
                <div class="prod-info">
                    <h3>${pName}</h3>
                    <p style="font-size: 12px; color: var(--text-sub);">${pDesc}</p>
                    <div class="med-details">
                        <p class="med-props"><i class="fa-solid fa-notes-medical med-icon"></i> <strong>${t('props')}</strong> ${pProps}</p>
                        <p class="med-warn"><i class="fa-solid fa-triangle-exclamation med-icon"></i> <strong>${t('warn')}</strong> ${pWarn}</p>
                    </div>
                    <div class="price-row">
                        <span class="price">฿${item.price}</span>
                        ${btnHTML}
                    </div>
                </div>
            </div>
        `;
    });
    renderAdminStock();
}

window.addToCart = function(id) {
    if (!auth.currentUser) {
        Swal.fire({icon: 'info', title: t('pls_login'), text: currentLang === 'th' ? 'ต้องล็อกอินก่อนหยิบยาใส่ตะกร้านะครับ' : 'You must login to add items.'});
        switchTab('view-account', document.getElementById('nav-account'));
        return;
    }
    const product = inventory.find(p => p.id === id);
    const cartItem = cart.find(c => c.id === id);
    if (cartItem) cartItem.qty += 1;
    else cart.push({ ...product, qty: 1 });
    
    updateCartUI();
    renderProducts();

    const floatBar = document.getElementById('cart-floating-bar');
    floatBar.classList.remove('bop-anim');
    void floatBar.offsetWidth; 
    floatBar.classList.add('bop-anim');
    Swal.fire({ toast: true, position: 'top', icon: 'success', title: t('swal_added'), showConfirmButton: false, timer: 1000 });
}

window.updateItemQty = function(id, delta) {
    const cartIndex = cart.findIndex(c => c.id === id);
    if (cartIndex > -1) {
        const product = inventory.find(p => p.id === id);
        let newQty = cart[cartIndex].qty + delta;
        if (newQty > product.stock) return Swal.fire({ toast: true, position: 'top', icon: 'error', title: t('swal_stock_err'), showConfirmButton: false, timer: 1500 });
        if (newQty <= 0) cart.splice(cartIndex, 1);
        else cart[cartIndex].qty = newQty;
        updateCartUI();
        renderProducts();
    }
}

function updateCartUI() {
    const floatBar = document.getElementById('cart-floating-bar');
    const modalContainer = document.getElementById('cart-items-container');
    let totalQty = 0; let totalPrice = 0;
    modalContainer.innerHTML = '';

    if (cart.length === 0) {
        floatBar.style.display = 'none';
        modalContainer.innerHTML = `<p style="text-align:center; color:#888; padding: 20px;">${t('empty_cart')}</p>`;
        document.getElementById('cart-grand-total').innerText = '฿0';
        closeModals();
        return;
    }

    cart.forEach(item => {
        let pName = currentLang === 'en' && item.nameEn ? item.nameEn : item.name;
        totalQty += item.qty; totalPrice += (item.price * item.qty);
        modalContainer.innerHTML += `
            <div class="cart-item">
                <div style="display:flex; gap:10px; align-items:center;">
                    <img src="${item.img}" style="width:40px; height:40px; border-radius:8px;" onerror="this.src='https://cdn-icons-png.flaticon.com/512/822/822102.png'">
                    <div>
                        <div style="font-size:14px; font-weight:500;">${pName}</div>
                        <div style="color:var(--tu-red); font-size:14px; font-weight:bold;">฿${item.price * item.qty}</div>
                    </div>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" onclick="updateItemQty('${item.id}', -1)">-</button>
                    <span style="font-size:14px; width:20px; text-align:center; font-weight:bold;">${item.qty}</span>
                    <button class="qty-btn" onclick="updateItemQty('${item.id}', 1)">+</button>
                </div>
            </div>
        `;
    });
    floatBar.style.display = 'flex';
    document.getElementById('cart-count-badge').innerText = totalQty;
    document.getElementById('cart-total-float').innerText = `฿${totalPrice}`;
    document.getElementById('cart-grand-total').innerText = `฿${totalPrice}`;
}

let timerInterval, paymentCheckInterval;

window.proceedToPayment = async function() {
    const consent = document.getElementById('consent-check').checked;
    if(!consent) {
        Swal.fire({icon: 'warning', title: t('swal_consent'), text: t('swal_consent_desc'), confirmButtonColor: 'var(--tu-red)'});
        return;
    }

    for (let item of cart) {
        const liveProd = inventory.find(p => p.id === item.id);
        if (!liveProd || liveProd.stock < item.qty) {
            let pName = currentLang === 'en' && item.nameEn ? item.nameEn : item.name;
            Swal.fire({ icon: 'error', title: t('out_of_stock'), text: currentLang === 'th' ? `สินค้า ${pName} ถูกซื้อไปเมื่อสักครู่` : `Item ${pName} was just purchased by someone else.` });
            closeModals();
            return;
        }
    }

    document.getElementById('cart-modal').style.display = 'none';
    let totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    let itemsSummary = cart.map(i => `${currentLang==='en' && i.nameEn ? i.nameEn : i.name} (x${i.qty})`).join(', ');
    let systemItemName = cart.map(i => `${i.name} (x${i.qty})`).join(', '); 
    
    document.getElementById('summary-price').innerText = `฿${totalPrice}.00`;
    document.getElementById('payment-ui').style.display = 'block';
    document.getElementById('hardware-sync-ui').style.display = 'none';
    document.getElementById('payment-modal').style.display = 'flex'; 
    
    const loader = document.getElementById('loader');
    const qrImg = document.getElementById('qr-image');
    const statusTxt = document.getElementById('qr-status');
    
    loader.style.display = 'block';
    qrImg.style.display = 'none';
    statusTxt.innerText = t('qr_gen');

    startTimer(180); 

    try {
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/create-qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ price: totalPrice, itemName: "ยา " + cart.length + " รายการ" })
        });
        const data = await response.json();

        if (data.qrImage) {
            loader.style.display = 'none';
            qrImg.src = data.qrImage;
            qrImg.style.display = 'block';
            statusTxt.innerText = currentLang === 'th' ? 'สแกนคิวอาร์โค้ดเพื่อชำระเงินและรับยา' : 'Scan QR Code to pay and dispense';
            mqttClient.publish("tse100/dispense", "PAYMENT_PENDING");
            startCheckingPayment(data.chargeId, systemItemName, totalPrice);
        } else throw new Error();
    } catch (error) {
        loader.style.display = 'none';
        statusTxt.innerText = currentLang === 'th' ? 'เกิดข้อผิดพลาด ไม่สามารถเชื่อมต่อระบบได้' : 'Connection Error';
        if(auth.currentUser && auth.currentUser.email.split('@')[0] === CONFIG.ADMIN_ID) {
            if(!document.getElementById('btn-simulate-admin')) {
                document.getElementById('summary-price').parentElement.insertAdjacentHTML('afterend', `<button id="btn-simulate-admin" class="btn-primary" style="margin-top:10px; background:#28a745;" onclick="simulatePayment('${systemItemName}', ${totalPrice})">Admin: Simulate Payment</button>`);
            }
        }
    }
}

function startTimer(seconds) {
    clearInterval(timerInterval);
    const display = document.getElementById('countdown');
    const progress = document.getElementById('timer-progress');
    let remaining = seconds;
    let total = seconds;
    
    progress.style.width = '100%';
    progress.style.background = '#28a745';

    timerInterval = setInterval(() => {
        let m = parseInt(remaining / 60, 10);
        let s = parseInt(remaining % 60, 10);
        display.textContent = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
        
        let percent = (remaining / total) * 100;
        progress.style.width = percent + '%';
        
        if (percent <= 20) { progress.style.background = '#c51d23'; } 
        else if (percent <= 50) { progress.style.background = '#ffc107'; }

        if (--remaining < 0) {
            clearInterval(timerInterval);
            closePayment();
            cart = []; updateCartUI(); renderProducts();
            Swal.fire({icon: 'error', title: t('swal_timeout'), text: t('swal_timeout_desc'), confirmButtonColor: 'var(--tu-red)'});
        }
    }, 1000);
}

window.simulatePayment = function(itemName, itemPrice) {
    clearInterval(paymentCheckInterval);
    clearInterval(timerInterval);
    processSuccessfulOrder("admin-test-charge", itemName, itemPrice);
}

function startCheckingPayment(chargeId, itemName, itemPrice) {
    paymentCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`${CONFIG.BACKEND_URL}/api/check-payment/${chargeId}`);
            const data = await response.json();
            if (data.status === 'success') {
                clearInterval(paymentCheckInterval); clearInterval(timerInterval);
                processSuccessfulOrder(chargeId, itemName, itemPrice);
            }
        } catch (error) {}
    }, 3000); 
}

async function processSuccessfulOrder(chargeId, itemName, itemPrice) {
    document.getElementById('payment-ui').style.display = 'none';
    document.getElementById('hardware-sync-ui').style.display = 'flex';
    
    mqttClient.publish("tse100/dispense", "PAYMENT_SUCCESS");
    
    for (const cartItem of cart) {
        const prod = inventory.find(p => p.id === cartItem.id);
        if(prod) {
            let newStock = prod.stock - cartItem.qty;
            if (newStock < 0) newStock = 0;
            await updateDoc(doc(db, "inventory", cartItem.id), { stock: newStock });
        }
    }

    if (auth.currentUser) {
        const stuId = auth.currentUser.email.split('@')[0];
        try {
            await addDoc(collection(db, "orders"), {
                stuId: stuId, itemName: itemName, price: itemPrice,
                chargeId: chargeId, status: "completed", createdAt: serverTimestamp() 
            });
        } catch (e) { }
    }

    setTimeout(() => {
        closePayment();
        Swal.fire({ 
            icon: 'success', 
            title: t('swal_pay_success'), 
            text: t('swal_pay_desc'), 
            timer: 3500, 
            showConfirmButton: false 
        }).then(() => {
            cart = []; updateCartUI(); 
            if(auth.currentUser.email.split('@')[0] !== CONFIG.ADMIN_ID) switchTab('view-orders', document.querySelectorAll('.nav-item')[1]);
        });
    }, 2500);
}

window.closePayment = function() {
    document.getElementById('payment-modal').style.display = 'none'; 
    clearInterval(timerInterval);
    if (paymentCheckInterval) clearInterval(paymentCheckInterval);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const stuId = user.email.split('@')[0];
        if (stuId === CONFIG.ADMIN_ID) {
            document.getElementById('nav-account').style.display = 'none';
            document.getElementById('nav-admin').style.display = 'flex';
            document.getElementById('auth-section').style.display = 'none';
            switchTab('view-admin', document.getElementById('nav-admin'));
            loadAdminDashboard();
        } else {
            document.getElementById('nav-account').style.display = 'flex';
            document.getElementById('nav-admin').style.display = 'none';
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('profile-section').style.display = 'block';
            document.getElementById('orders-login-warning').style.display = 'none';
            document.getElementById('orders-list-container').style.display = 'block';
            document.getElementById('displayStuId').innerText = stuId;
            
            getDoc(doc(db, "users", stuId)).then(userDoc => {
                if(userDoc.exists()) {
                    const d = userDoc.data();
                    document.getElementById('displayFullName').innerText = d.fullName || t('unspec');
                    document.getElementById('displayPhone').innerText = d.phone || t('unspec');
                } else {
                    document.getElementById('displayFullName').innerText = t('unspec');
                    document.getElementById('displayPhone').innerText = t('unspec');
                }
            });

            loadOrders(stuId); 
        }
    } else {
        document.getElementById('nav-account').style.display = 'flex';
        document.getElementById('nav-admin').style.display = 'none';
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('profile-section').style.display = 'none';
        document.getElementById('orders-login-warning').style.display = 'block';
        document.getElementById('orders-list-container').style.display = 'none';
    }
});

document.getElementById('btnLogin').addEventListener('click', () => {
    const id = document.getElementById('stuIdInput').value.trim();
    const pwd = document.getElementById('pwdInput').value.trim();
    if(!id || !pwd) return alert(currentLang === 'th' ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : 'Please fill all fields');
    signInWithEmailAndPassword(auth, id + CONFIG.FAKE_DOMAIN, pwd).catch(() => alert(currentLang === 'th' ? 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง' : 'Invalid Student ID or Password'));
});

document.getElementById('btnRegister').addEventListener('click', () => {
    const id = document.getElementById('stuIdInput').value.trim();
    const pwd = document.getElementById('pwdInput').value.trim();
    if(id.length < 10) return alert(currentLang === 'th' ? 'กรุณากรอกรหัสนักศึกษาให้ครบ 10 หลัก' : 'Student ID must be 10 digits');
    if(pwd.length < 6) return alert(currentLang === 'th' ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' : 'Password must be at least 6 characters');
    createUserWithEmailAndPassword(auth, id + CONFIG.FAKE_DOMAIN, pwd).then(() => alert(currentLang === 'th' ? 'สมัครสมาชิกสำเร็จ!' : 'Registered successfully!')).catch((err) => alert(t('swal_err') + ': ' + err.message));
});

document.getElementById('btnLogout').addEventListener('click', () => signOut(auth));
document.getElementById('btnAdminLogout').addEventListener('click', () => {
    signOut(auth).then(() => { switchTab('view-home', document.querySelector('.nav-item')); });
});

document.getElementById('btnEditProfile').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    const stuId = auth.currentUser.email.split('@')[0];
    
    let currentName = document.getElementById('displayFullName').innerText;
    let currentPhone = document.getElementById('displayPhone').innerText;
    
    if (currentName === t('unspec')) currentName = '';
    if (currentPhone === t('unspec')) currentPhone = '';

    const { value: formValues } = await Swal.fire({
        title: t('swal_edit_title'),
        html:
            `<input id="swal-input-name" class="swal2-input" placeholder="${t('swal_ph_name')}" value="${currentName}">` +
            `<input id="swal-input-phone" type="number" class="swal2-input" placeholder="${t('swal_ph_phone')}" value="${currentPhone}">`,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: t('swal_btn_save'),
        cancelButtonText: t('swal_btn_cancel'),
        confirmButtonColor: 'var(--tu-red)',
        preConfirm: () => {
            return [
                document.getElementById('swal-input-name').value,
                document.getElementById('swal-input-phone').value
            ]
        }
    });

    if (formValues) {
        const [fullName, phone] = formValues;
        try {
            await setDoc(doc(db, "users", stuId), { fullName, phone }, { merge: true });
            document.getElementById('displayFullName').innerText = fullName || t('unspec');
            document.getElementById('displayPhone').innerText = phone || t('unspec');
            Swal.fire({icon: 'success', title: t('swal_save_success'), showConfirmButton: false, timer: 1500});
        } catch(e) {
            Swal.fire(t('swal_err'), '', 'error');
        }
    }
});

document.getElementById('btnResetPwd').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    
    const { value: newPassword } = await Swal.fire({
        title: t('swal_pwd_title'),
        input: 'password',
        inputPlaceholder: t('swal_pwd_ph'),
        showCancelButton: true,
        confirmButtonText: t('swal_btn_confirm'),
        cancelButtonText: t('swal_btn_cancel'),
        confirmButtonColor: 'var(--tu-red)',
        inputValidator: (value) => {
            if (!value || value.length < 6) return t('swal_pwd_ph');
        }
    });

    if (newPassword) {
        updatePassword(auth.currentUser, newPassword).then(() => {
            Swal.fire({icon: 'success', title: t('swal_pwd_success'), showConfirmButton: false, timer: 1500});
        }).catch((error) => {
            if (error.code === 'auth/requires-recent-login') {
                Swal.fire(t('swal_err'), currentLang === 'th' ? 'กรุณาล็อกเอาท์และเข้าสู่ระบบใหม่' : 'Please re-login to change password', 'error');
            } else {
                Swal.fire(t('swal_err'), error.message, 'error');
            }
        });
    }
});

function renderAdminStock() {
    const container = document.getElementById('admin-stock-container');
    if(!container) return;
    container.innerHTML = '';
    inventory.forEach(item => {
        const isLowStock = item.stock < 3;
        const cardClass = isLowStock ? 'admin-stock-item low-stock-alert' : 'admin-stock-item';
        let pName = currentLang === 'en' && item.nameEn ? item.nameEn : item.name;
        
        container.innerHTML += `
            <div class="${cardClass}">
                <div class="admin-stock-row-1">
                    <span style="font-size:14px; font-weight:600; color: ${isLowStock ? '#c51d23' : '#333'}">${pName}</span>
                    ${isLowStock ? `<span style="font-size:10px; color:white; background:#c51d23; padding:2px 6px; border-radius:10px;">${currentLang === 'th' ? 'ใกล้หมด!' : 'Low!'}</span>` : ''}
                </div>
                <div class="admin-stock-row-2">
                    <div style="font-size:12px; color:var(--text-sub); display:flex; align-items:center; gap:5px;">
                        ${currentLang === 'th' ? 'ราคา' : 'Price'}: ฿<input type="number" class="price-input" value="${item.price}" onchange="adminUpdatePrice('${item.id}', this.value)">
                    </div>
                    <div class="qty-controls" style="background:#fff; border:1px solid #ddd;">
                        <button class="qty-btn" onclick="adminAdjustStock('${item.id}', -1)">-</button>
                        <span style="font-size:14px; width:30px; text-align:center;">${item.stock}</span>
                        <button class="qty-btn" onclick="adminAdjustStock('${item.id}', 1)">+</button>
                    </div>
                </div>
            </div>
        `;
    });
}

window.adminAdjustStock = async function(id, delta) {
    const prod = inventory.find(p => p.id === id);
    if(prod) {
        let newStock = prod.stock + delta;
        if(newStock < 0) newStock = 0;
        await updateDoc(doc(db, "inventory", id), { stock: newStock });
    }
}

window.adminUpdatePrice = async function(id, newPrice) {
    const priceNum = parseInt(newPrice);
    if(priceNum >= 0) {
        await updateDoc(doc(db, "inventory", id), { price: priceNum });
        Swal.fire({ toast: true, position: 'top', icon: 'success', title: currentLang === 'th' ? 'อัปเดตราคาสำเร็จ' : 'Price Updated', showConfirmButton: false, timer: 1500 });
    }
}

async function loadAdminDashboard() {
    try {
        const ordersList = document.getElementById('admin-all-orders-list');
        const q = query(collection(db, "orders"));
        const querySnapshot = await getDocs(q);
        
        const allOrders = [];
        let totalSales = 0;
        let todaySales = 0;
        const todayStr = new Date().toLocaleDateString('th-TH');

        querySnapshot.forEach((doc) => { 
            const data = doc.data(); 
            allOrders.push({id: doc.id, ...data}); 
            const price = parseInt(data.price || 0);
            totalSales += price;
            if (data.createdAt && new Date(data.createdAt.toDate()).toLocaleDateString('th-TH') === todayStr) todaySales += price;
        });

        adminGlobalOrdersData = allOrders;
        document.getElementById('admin-total-sales').innerText = `฿${totalSales.toLocaleString()}`;
        document.getElementById('admin-today-sales').innerText = `฿${todaySales.toLocaleString()}`;

        allOrders.sort((a, b) => { return (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0); });

        if(allOrders.length === 0) {
            ordersList.innerHTML = `<p style="text-align:center; color:var(--text-sub); font-size:13px; margin:20px 0;">${currentLang === 'th' ? 'ยังไม่มีรายการสั่งซื้อในระบบ' : 'No orders yet.'}</p>`;
            return;
        }

        let html = '';
        allOrders.forEach(order => {
            const dateObj = order.createdAt ? new Date(order.createdAt.toDate()) : new Date();
            const dateStr = currentLang === 'en' ? dateObj.toLocaleDateString('en-GB') : dateObj.toLocaleDateString('th-TH');
            const timeStr = dateObj.toLocaleTimeString(currentLang === 'en' ? 'en-GB' : 'th-TH', { hour: '2-digit', minute: '2-digit' });
            
            html += `
                <div style="padding: 12px 0; border-bottom: 1px solid #f0f1f4;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="font-weight:600; font-size:13px;">${order.itemName}</span>
                        <span style="color:var(--tu-red); font-weight:600;">฿${order.price}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-sub);">
                        <span><i class="fa-regular fa-user"></i> ${order.stuId}</span>
                        <span>${dateStr} ${timeStr}</span>
                    </div>
                </div>`;
        });
        ordersList.innerHTML = html;

    } catch (error) {}
}

window.exportOrdersCSV = function() {
    if(adminGlobalOrdersData.length === 0) return Swal.fire(currentLang === 'th' ? 'ไม่มีข้อมูล' : 'No Data', '', 'info');
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += currentLang === 'th' ? "วันที่,เวลา,รหัสนักศึกษา,รายการสินค้า,ราคา(บาท)\n" : "Date,Time,StudentID,Items,Price(THB)\n";
    adminGlobalOrdersData.forEach(o => {
        let dateObj = o.createdAt ? new Date(o.createdAt.toDate()) : new Date();
        let dateStr = dateObj.toLocaleDateString('th-TH');
        let timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        let safeName = o.itemName ? o.itemName.replace(/,/g, " ") : "ไม่มีชื่อ";
        csvContent += `${dateStr},${timeStr},${o.stuId},${safeName},${o.price}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "tu_smart_rx_sales_report.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

window.testDispense = function() {
    mqttClient.publish("tse100/dispense", "PAYMENT_SUCCESS");
    Swal.fire({ toast: true, position: 'top', icon: 'success', title: currentLang==='th'?'ส่งสัญญาณไปที่ตู้แล้ว':'Command Sent', showConfirmButton: false, timer: 1500 });
}

async function loadOrders(stuId) {
    const ordersList = document.getElementById('orders-list');
    if(document.getElementById('view-orders').classList.contains('active')) ordersList.innerHTML = '<div class="loader"></div>';
    try {
        const q = query(collection(db, "orders"), where("stuId", "==", stuId));
        const querySnapshot = await getDocs(q);
        const orders = []; let totalSpent = 0;
        querySnapshot.forEach((doc) => { 
            const data = doc.data(); 
            orders.push({id: doc.id, ...data}); 
            totalSpent += parseInt(data.price || 0); 
        });
        document.getElementById('stat-total-orders').innerText = orders.length;
        document.getElementById('stat-total-spent').innerText = `฿${totalSpent}`;
        orders.sort((a, b) => { return (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0); });

        if(orders.length === 0) {
            ordersList.innerHTML = `<p style="text-align:center; color:var(--text-sub); margin-top:20px;">${currentLang === 'th' ? 'ยังไม่มีประวัติการรับยา' : 'No prescription history.'}</p>`;
            return;
        }
        let html = '';
        orders.forEach(order => {
            const dateObj = order.createdAt ? new Date(order.createdAt.toDate()) : new Date();
            const dateStr = currentLang === 'en' ? dateObj.toLocaleDateString('en-GB') : dateObj.toLocaleDateString('th-TH');
            const timeStr = dateObj.toLocaleTimeString(currentLang === 'en' ? 'en-GB' : 'th-TH', { hour: '2-digit', minute: '2-digit' });
            
            let translatedItemName = order.itemName;
            if(currentLang === 'en') {
                translatedItemName = translatedItemName.replace('พาราเซตามอล 500mg', 'Paracetamol 500mg')
                                                       .replace('ผงถ่านคาร์บอน', 'Activated Charcoal')
                                                       .replace('พลาสเตอร์ยา (5 ชิ้น)', 'Medical Plaster (5 pcs)')
                                                       .replace('ยาดมตราโป๊ยเซียน', 'Poy-Sian Inhaler');
            }
            const safeItemName = translatedItemName ? translatedItemName.replace(/'/g, "\\'") : "";

            html += `<div class="order-history-card">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                            <strong>${translatedItemName}</strong> <span style="color: var(--tu-red); font-weight:bold;">฿${order.price}</span>
                        </div>
                        <div style="font-size: 12px; color: var(--text-sub); display: flex; justify-content: space-between; align-items:center;">
                            <span><i class="fa-regular fa-clock"></i> ${dateStr} ${timeStr}</span> 
                            <span style="color: #28a745; font-weight:500;">${t('rcpt_success')}</span>
                        </div>
                        <button class="btn-secondary" style="width: 100%; margin-top: 10px; padding: 8px; font-size: 12px; background: #f5f6f8; color: #1d1d1f;" 
                            onclick="showReceipt('${order.chargeId || order.id}', '${dateStr} ${timeStr}', '${safeItemName}', ${order.price})">
                            <i class="fa-solid fa-receipt"></i> ${t('btn_view_rcpt')}
                        </button>
                    </div>`;
        });
        ordersList.innerHTML = html;
    } catch (error) { }
}

window.showReceipt = function(ref, dateTime, items, price) {
    document.getElementById('receipt-ref').innerText = `Ref: ${ref}`;
    document.getElementById('receipt-date').innerText = `${t('rcpt_date')} ${dateTime}`;
    document.getElementById('receipt-items-list').innerHTML = `
        <div class="receipt-row">
            <span style="flex: 1; padding-right: 10px;">${items}</span>
            <span>฿${price}.00</span>
        </div>
    `;
    document.getElementById('receipt-grand-total').innerText = `฿${price}.00`;
    document.getElementById('receipt-modal').style.display = 'flex';
}
window.closeReceipt = () => document.getElementById('receipt-modal').style.display = 'none';
