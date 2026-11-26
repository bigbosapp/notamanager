
/* =====================================================
   NOTA MANAGER
   Firebase Authentication + Cloud Firestore
   ===================================================== */

   import { initializeApp } from
   "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
 
 import {
   getAuth,
   createUserWithEmailAndPassword,
   signInWithEmailAndPassword,
   signOut,
   onAuthStateChanged,
   updateProfile
 } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
 
 import {
   getFirestore,
   collection,
   doc,
   getDocs,
   getDoc,
   setDoc,
   addDoc,
   updateDoc,
   deleteDoc,
   writeBatch,
   serverTimestamp
 } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
 
 
 /* =====================================================
    1. KONFIGURASI FIREBASE
    ===================================================== */
 
 const firebaseConfig = {
   apiKey: "AIzaSyAh-CXaUk_gH4HMgavOnupWKBEEtfLq6dc",
   authDomain: "notamanager.firebaseapp.com",
   projectId: "notamanager",
   storageBucket: "notamanager.firebasestorage.app",
   messagingSenderId: "108483555720",
   appId: "1:108483555720:web:d28bd81884864fd7aaca3d",
   measurementId: "G-XZTDY1L2GW"
 };
 
 const firebaseApp = initializeApp(firebaseConfig);
 const auth = getAuth(firebaseApp);
 const db = getFirestore(firebaseApp);
 
 
 /* =====================================================
    2. STATE APLIKASI
    ===================================================== */
 
 let currentUser = null;
 
 let invoices = [];
 let customers = [];
 let categories = [];
 
 let selectedCustomer = null;
 let editingCategory = null;
 let editingInvoiceId = null;
 let pendingConfirmation = null;
 let currentPreview = null;
 
 let chartResizeTimer = null;
 let toastTimer = null;
 
 let customerChartEntries = [];
 let categoryChartEntries = [];
 
 let currentSettings = {
   color: "#263b52",
   fontSize: 14
 };
 
 let settingsDraft = {
   color: "#263b52",
   fontSize: 14
 };
 
 const DEFAULT_SETTINGS = {
   color: "#263b52",
   fontSize: 14
 };
 
 const CHART_COLORS = [
   "#426b91",
   "#7796b5",
   "#9cabc0",
   "#b58d67",
   "#779d89",
   "#a77d7d",
   "#6e849d",
   "#c0a477",
   "#7c8caa",
   "#9b9c85",
   "#8b7599",
   "#6b9c9c"
 ];
 
 const $ = id => document.getElementById(id);
 
 
 /* =====================================================
    3. REFERENSI FIRESTORE
    ===================================================== */
 
 function userCollection(collectionName) {
   if (!currentUser) {
     throw new Error("Akun belum terautentikasi.");
   }
 
   return collection(
     db,
     "users",
     currentUser.uid,
     collectionName
   );
 }
 
 function userDocument(collectionName, documentId) {
   if (!currentUser) {
     throw new Error("Akun belum terautentikasi.");
   }
 
   return doc(
     db,
     "users",
     currentUser.uid,
     collectionName,
     documentId
   );
 }
 
 function settingsDocument() {
   if (!currentUser) {
     throw new Error("Akun belum terautentikasi.");
   }
 
   return doc(
     db,
     "users",
     currentUser.uid,
     "settings",
     "preferences"
   );
 }
 
 
 /* =====================================================
    4. FUNGSI UMUM
    ===================================================== */
 
 function escapeHTML(value) {
   return String(value ?? "").replace(/[&<>"']/g, char => ({
     "&": "&amp;",
     "<": "&lt;",
     ">": "&gt;",
     '"': "&quot;",
     "'": "&#039;"
   })[char]);
 }
 
 function normalizeName(value) {
   return String(value || "")
     .trim()
     .replace(/\s+/g, " ");
 }
 
 function rupiah(value) {
   return "Rp " + Number(value || 0).toLocaleString("id-ID");
 }
 
 function localDate(date = new Date()) {
   const offset = date.getTimezoneOffset();
 
   return new Date(
     date.getTime() - offset * 60000
   ).toISOString().slice(0, 10);
 }
 
 function formatDate(value) {
   if (!value) return "-";
 
   const parts = String(value).split("-");
 
   if (parts.length !== 3) return value;
 
   return `${parts[2]}/${parts[1]}/${parts[0]}`;
 }
 
 function makeId() {
   return crypto.randomUUID();
 }
 
 function showToast(message, type = "success") {
   const toast = $("toast");
 
   toast.textContent = message;
   toast.className = `toast show ${type}`;
 
   clearTimeout(toastTimer);
 
   toastTimer = setTimeout(() => {
     toast.classList.remove("show");
   }, 3000);
 }
 
 function showAuthMessage(message, type = "error") {
   const element = $("authMessage");
 
   element.textContent = message;
   element.className =
     type === "success"
       ? "auth-message success"
       : "auth-message";
 }
 
 function firebaseErrorMessage(error) {
   const code = error?.code || "";
 
   const messages = {
     "auth/email-already-in-use":
       "Email tersebut sudah terdaftar.",
 
     "auth/invalid-email":
       "Format email tidak valid.",
 
     "auth/weak-password":
       "Kata sandi terlalu lemah. Gunakan minimal 6 karakter.",
 
     "auth/invalid-credential":
       "Email atau kata sandi tidak sesuai.",
 
     "auth/user-not-found":
       "Akun tidak ditemukan.",
 
     "auth/wrong-password":
       "Kata sandi tidak sesuai.",
 
     "auth/too-many-requests":
       "Terlalu banyak percobaan. Silakan coba kembali nanti.",
 
     "auth/network-request-failed":
       "Koneksi internet bermasalah.",
 
     "permission-denied":
       "Akses ditolak. Periksa Firestore Security Rules.",
 
     "unavailable":
       "Layanan Firebase sementara tidak tersedia."
   };
 
   return messages[code] ||
     error?.message ||
     "Terjadi kesalahan. Silakan coba kembali.";
 }
 
 
 /* =====================================================
    5. PERGANTIAN HALAMAN LOGIN DAN DAFTAR
    ===================================================== */
 
 function showLoginForm() {
   $("loginForm").classList.remove("hidden");
   $("registerForm").classList.add("hidden");
 
   showAuthMessage("");
 }
 
 function showRegisterForm() {
   $("loginForm").classList.add("hidden");
   $("registerForm").classList.remove("hidden");
 
   showAuthMessage("");
 }
 
 $("showRegister").addEventListener("click", showRegisterForm);
 $("showLogin").addEventListener("click", showLoginForm);
 
 
 /* =====================================================
    6. PENDAFTARAN AKUN
    ===================================================== */
 
 $("registerForm").addEventListener("submit", async event => {
   event.preventDefault();
 
   const name = normalizeName($("registerName").value);
   const email = $("registerEmail").value.trim();
   const password = $("registerPassword").value;
   const passwordConfirm = $("registerPasswordConfirm").value;
 
   if (!name || !email || !password) {
     showAuthMessage("Lengkapi seluruh data pendaftaran.");
     return;
   }
 
   if (password.length < 6) {
     showAuthMessage("Kata sandi minimal 6 karakter.");
     return;
   }
 
   if (password !== passwordConfirm) {
     showAuthMessage("Konfirmasi kata sandi tidak sama.");
     return;
   }
 
   const submitButton =
     $("registerForm").querySelector('[type="submit"]');
 
   submitButton.disabled = true;
   submitButton.textContent = "Mendaftarkan...";
 
   try {
     const credential = await createUserWithEmailAndPassword(
       auth,
       email,
       password
     );
 
     await updateProfile(credential.user, {
       displayName: name
     });
 
     showAuthMessage(
       "Pendaftaran berhasil. Menyiapkan akun...",
       "success"
     );
 
   } catch (error) {
     showAuthMessage(firebaseErrorMessage(error));
   } finally {
     submitButton.disabled = false;
     submitButton.textContent = "Buat Akun";
   }
 });
 
 
 /* =====================================================
    7. LOGIN
    ===================================================== */
 
 $("loginForm").addEventListener("submit", async event => {
   event.preventDefault();
 
   const email = $("loginEmail").value.trim();
   const password = $("loginPassword").value;
 
   if (!email || !password) {
     showAuthMessage("Masukkan email dan kata sandi.");
     return;
   }
 
   const submitButton =
     $("loginForm").querySelector('[type="submit"]');
 
   submitButton.disabled = true;
   submitButton.textContent = "Memeriksa akun...";
 
   try {
     await signInWithEmailAndPassword(
       auth,
       email,
       password
     );
 
   } catch (error) {
     showAuthMessage(firebaseErrorMessage(error));
   } finally {
     submitButton.disabled = false;
     submitButton.textContent = "Masuk";
   }
 });
 
 
 /* =====================================================
    8. PROFIL DAN KELUAR
    ===================================================== */
 
 function updateProfileInformation(user) {
   const email = user?.email || "-";
 
   $("profileEmail").textContent = email;
   $("profileModalEmail").textContent = email;
 }
 
 $("profileButton").addEventListener("click", () => {
   $("profileDropdown").classList.toggle("hidden");
 });
 
 document.addEventListener("click", event => {
   const area = document.querySelector(".profile-area");
 
   if (area && !area.contains(event.target)) {
     $("profileDropdown").classList.add("hidden");
   }
 });
 
 function requestLogout() {
   $("profileDropdown").classList.add("hidden");
 
   askConfirmation(
     "Keluar dari akun?",
     async () => {
       try {
         await signOut(auth);
         showToast("Anda telah keluar.");
       } catch (error) {
         showToast(firebaseErrorMessage(error), "error");
       }
     },
     "Konfirmasi Keluar",
     "Keluar"
   );
 }
 
 $("logoutButton").addEventListener("click", requestLogout);
 $("profileLogoutButton").addEventListener("click", requestLogout);
 
 
 /* =====================================================
    9. PEMUATAN DATA FIRESTORE
    ===================================================== */
 
 async function loadCollection(collectionName) {
   const snapshot = await getDocs(
     userCollection(collectionName)
   );
 
   return snapshot.docs.map(item => ({
     id: item.id,
     ...item.data()
   }));
 }
 
 async function loadAllAccountData() {
   const [invoiceData, customerData, categoryData] =
     await Promise.all([
       loadCollection("invoices"),
       loadCollection("customers"),
       loadCollection("categories")
     ]);
 
   invoices = invoiceData;
   customers = customerData;
   categories = categoryData;
 
   renderCustomerOptions();
   renderCustomers();
   renderCategories();
   renderManager();
 
   resetInvoiceForm();
 
   if ($("page-analisa").classList.contains("active")) {
     renderAnalytics();
   }
 }
 
 
 /* =====================================================
    10. PENYIMPANAN PENGATURAN AKUN
    ===================================================== */
 
 async function loadSettings() {
   const snapshot = await getDoc(settingsDocument());
 
   if (snapshot.exists()) {
     const data = snapshot.data();
 
     currentSettings = {
       color: isValidHex(data.color)
         ? data.color
         : DEFAULT_SETTINGS.color,
 
       fontSize: clampFontSize(data.fontSize)
     };
   } else {
     currentSettings = { ...DEFAULT_SETTINGS };
 
     await setDoc(settingsDocument(), {
       ...currentSettings,
       updatedAt: serverTimestamp()
     });
   }
 
   settingsDraft = { ...currentSettings };
 
   applySettings(currentSettings);
 }
 
 function isValidHex(value) {
   return /^#[0-9a-fA-F]{6}$/.test(String(value || ""));
 }
 
 function clampFontSize(value) {
   const number = Number(value);
 
   if (!Number.isFinite(number)) {
     return DEFAULT_SETTINGS.fontSize;
   }
 
   return Math.min(20, Math.max(12, number));
 }
 
 function applySettings(settings) {
   const color = settings.color;
   const fontSize = clampFontSize(settings.fontSize);
 
   document.documentElement.style.setProperty(
     "--primary",
     color
   );
 
   document.documentElement.style.setProperty(
     "--primary-dark",
     shadeColor(color, -18)
   );
 
   document.documentElement.style.setProperty(
     "--primary-light",
     shadeColor(color, 88)
   );
 
   document.documentElement.style.setProperty(
     "--accent",
     shadeColor(color, 18)
   );
 
   document.documentElement.style.setProperty(
     "--font-size",
     `${fontSize}px`
   );
 }
 
 function shadeColor(hex, percent) {
   const clean = hex.replace("#", "");
 
   const number = parseInt(clean, 16);
 
   let red = (number >> 16) & 255;
   let green = (number >> 8) & 255;
   let blue = number & 255;
 
   const target = percent < 0 ? 0 : 255;
   const amount = Math.abs(percent) / 100;
 
   red = Math.round(red + (target - red) * amount);
   green = Math.round(green + (target - green) * amount);
   blue = Math.round(blue + (target - blue) * amount);
 
   return "#" + [red, green, blue]
     .map(value => value.toString(16).padStart(2, "0"))
     .join("");
 }
 
 
 /* =====================================================
    11. PEMBUKAAN PENGATURAN
    ===================================================== */
 
 $("openSettings").addEventListener("click", () => {
   $("profileDropdown").classList.add("hidden");
 
   settingsDraft = { ...currentSettings };
 
   $("themeColor").value = settingsDraft.color;
   $("themeColorValue").textContent =
     settingsDraft.color.toUpperCase();
 
   $("fontSize").value = settingsDraft.fontSize;
   $("fontSizeValue").textContent = settingsDraft.fontSize;
 
   $("settingsModal").classList.remove("hidden");
 });
 
 
 /* =====================================================
    12. PRATINJAU PENGATURAN
    ===================================================== */
 
 $("themeColor").addEventListener("input", () => {
   settingsDraft.color = $("themeColor").value;
 
   $("themeColorValue").textContent =
     settingsDraft.color.toUpperCase();
 
   applySettings(settingsDraft);
 });
 
 $("fontSize").addEventListener("input", () => {
   settingsDraft.fontSize = clampFontSize($("fontSize").value);
 
   $("fontSizeValue").textContent =
     settingsDraft.fontSize;
 
   applySettings(settingsDraft);
 });
 
 
 /* =====================================================
    13. SIMPAN PENGATURAN KE FIRESTORE
    ===================================================== */
 
 $("saveSettings").addEventListener("click", async () => {
   if (!currentUser) return;
 
   const button = $("saveSettings");
 
   button.disabled = true;
   button.textContent = "Menyimpan...";
 
   try {
     const settings = {
       color: settingsDraft.color,
       fontSize: clampFontSize(settingsDraft.fontSize),
       updatedAt: serverTimestamp()
     };
 
     await setDoc(settingsDocument(), settings);
 
     currentSettings = {
       color: settings.color,
       fontSize: settings.fontSize
     };
 
     applySettings(currentSettings);
 
     $("settingsModal").classList.add("hidden");
 
     showToast("Pengaturan berhasil disimpan.");
 
   } catch (error) {
     showToast(firebaseErrorMessage(error), "error");
   } finally {
     button.disabled = false;
     button.textContent = "Simpan Pengaturan";
   }
 });
 
 
 /* =====================================================
    14. ATUR ULANG PENGATURAN
    ===================================================== */
 
 $("resetSettings").addEventListener("click", () => {
   settingsDraft = { ...DEFAULT_SETTINGS };
 
   $("themeColor").value = settingsDraft.color;
   $("themeColorValue").textContent =
     settingsDraft.color.toUpperCase();
 
   $("fontSize").value = settingsDraft.fontSize;
   $("fontSizeValue").textContent =
     settingsDraft.fontSize;
 
   applySettings(settingsDraft);
 });

/* =====================================================
   15. MODAL DAN KONFIRMASI
   ===================================================== */

   function askConfirmation(
    message,
    callback,
    title = "Konfirmasi",
    confirmLabel = "Lanjutkan"
  ) {
    pendingConfirmation = callback;
  
    $("confirmTitle").textContent = title;
    $("confirmMessage").textContent = message;
    $("confirmAction").textContent = confirmLabel;
  
    $("confirmModal").classList.remove("hidden");
  }
  
  $("confirmAction").addEventListener("click", async () => {
    const callback = pendingConfirmation;
    pendingConfirmation = null;
  
    $("confirmModal").classList.add("hidden");
  
    if (typeof callback === "function") {
      try {
        await callback();
      } catch (error) {
        showToast(firebaseErrorMessage(error), "error");
      }
    }
  });
  
  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const modal = $(button.dataset.close);
      if (modal) modal.classList.add("hidden");
    });
  });
  
  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
      if (event.target === modal) {
        modal.classList.add("hidden");
      }
    });
  });
  
  
  /* =====================================================
     16. NAVIGASI HALAMAN
     ===================================================== */
  
  document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;
  
      document.querySelectorAll(".nav-btn")
        .forEach(item => item.classList.remove("active"));
  
      document.querySelectorAll(".page")
        .forEach(item => item.classList.remove("active"));
  
      button.classList.add("active");
      $("page-" + page).classList.add("active");
  
      if (page === "manager") renderManager();
      if (page === "kategori") renderCategories();
      if (page === "pelanggan") renderCustomers();
  
      if (page === "analisa") {
        requestAnimationFrame(() => {
          renderAnalytics();
          requestAnimationFrame(renderAnalytics);
        });
      }
    });
  });
  
  $("today").textContent = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
  
  
  /* =====================================================
     17. PELANGGAN - FIRESTORE
     ===================================================== */
  
  function findCustomer(name) {
    const normalized = normalizeName(name).toLowerCase();
  
    return customers.find(customer =>
      normalizeName(customer.name).toLowerCase() === normalized
    );
  }
  
  async function addCustomer(name) {
    name = normalizeName(name);
  
    if (!name) {
      throw new Error("Nama pelanggan tidak boleh kosong.");
    }
  
    const existing = findCustomer(name);
  
    if (existing) return existing;
  
    const customer = {
      name,
      createdAt: serverTimestamp()
    };
  
    const reference = await addDoc(
      userCollection("customers"),
      customer
    );
  
    const saved = {
      id: reference.id,
      name
    };
  
    customers.push(saved);
  
    return saved;
  }
  
  async function saveCustomer(name) {
    name = normalizeName(name);
  
    if (!name) {
      showToast("Masukkan nama pelanggan.", "error");
      return;
    }
  
    if (findCustomer(name)) {
      showToast("Pelanggan sudah terdaftar.", "error");
      return;
    }
  
    await addCustomer(name);
  
    saveCustomerFormReset();
    renderCustomers();
    renderCustomerOptions();
    renderManager();
  
    showToast("Pelanggan berhasil disimpan.");
  }
  
  function saveCustomerFormReset() {
    $("customerName").value = "";
  }
  
  function renderCustomerOptions(selected = "") {
    const select = $("pelangganNota");
  
    const sorted = [...customers].sort((a, b) =>
      a.name.localeCompare(b.name, "id")
    );
  
    select.innerHTML =
      `<option value="">Pilih pelanggan</option>` +
      sorted.map(customer => `
        <option value="${escapeHTML(customer.name)}">
          ${escapeHTML(customer.name)}
        </option>
      `).join("") +
      `<option value="__other__">＋ Tambah pelanggan baru</option>`;
  
    select.value = selected && findCustomer(selected)
      ? findCustomer(selected).name
      : "";
  
    $("pelangganBaru").classList.add("hidden");
    $("pelangganBaru").value = "";
  
    if (selected && !findCustomer(selected)) {
      select.value = "__other__";
      $("pelangganBaru").value = selected;
      $("pelangganBaru").classList.remove("hidden");
    }
  }
  
  $("pelangganNota").addEventListener("change", () => {
    const isOther = $("pelangganNota").value === "__other__";
  
    $("pelangganBaru").classList.toggle("hidden", !isOther);
  
    if (isOther) {
      $("pelangganBaru").value = "";
      $("pelangganBaru").focus();
    }
  });
  
  function currentInvoiceCustomer() {
    return normalizeName(
      $("pelangganNota").value === "__other__"
        ? $("pelangganBaru").value
        : $("pelangganNota").value
    );
  }
  
  function renderCustomers() {
    const body = $("customerList");
  
    if (!customers.length) {
      body.innerHTML = `
        <tr>
          <td colspan="3" class="empty-state">
            Belum ada data pelanggan.
          </td>
        </tr>
      `;
      return;
    }
  
    body.innerHTML = [...customers]
      .sort((a, b) => a.name.localeCompare(b.name, "id"))
      .map((customer, index) => `
        <tr>
          <td>${index + 1}</td>
          <td style="text-align:left">
            ${escapeHTML(customer.name)}
          </td>
          <td>
            <div class="action-buttons">
              <button class="btn small secondary"
                data-customer-edit="${customer.id}">
                Ubah
              </button>
              <button class="btn small danger"
                data-customer-delete="${customer.id}">
                Hapus
              </button>
            </div>
          </td>
        </tr>
      `).join("");
  }
  
  $("customerForm").addEventListener("submit", async event => {
    event.preventDefault();
  
    try {
      await saveCustomer($("customerName").value);
    } catch (error) {
      showToast(firebaseErrorMessage(error), "error");
    }
  });
  
  $("customerList").addEventListener("click", async event => {
    const editId = event.target.dataset.customerEdit;
    const deleteId = event.target.dataset.customerDelete;
  
    if (editId) {
      const customer = customers.find(item => item.id === editId);
      if (!customer) return;
  
      openTextEditor(
        "Ubah Nama Pelanggan",
        "Nama pelanggan",
        customer.name,
        async newName => {
          newName = normalizeName(newName);
  
          if (!newName) {
            showToast("Nama tidak boleh kosong.", "error");
            return;
          }
  
          if (customers.some(item =>
            item.id !== editId &&
            item.name.toLowerCase() === newName.toLowerCase()
          )) {
            showToast("Nama pelanggan sudah digunakan.", "error");
            return;
          }
  
          await updateDoc(
            userDocument("customers", editId),
            { name: newName, updatedAt: serverTimestamp() }
          );
  
          const oldName = customer.name;
          customer.name = newName;
  
          const affected = invoices.filter(invoice =>
            invoice.customer === oldName
          );
  
          for (const invoice of affected) {
            invoice.customer = newName;
  
            await updateDoc(
              userDocument("invoices", invoice.id),
              {
                customer: newName,
                updatedAt: serverTimestamp()
              }
            );
          }
  
          renderCustomers();
          renderCustomerOptions();
          renderManager();
  
          showToast("Pelanggan berhasil diperbarui.");
        }
      );
    }
  
    if (deleteId) {
      const customer = customers.find(item => item.id === deleteId);
      if (!customer) return;
  
      askConfirmation(
        `Hapus pelanggan "${customer.name}"? Nota yang sudah tersimpan tetap dipertahankan.`,
        async () => {
          await deleteDoc(userDocument("customers", deleteId));
  
          customers = customers.filter(item => item.id !== deleteId);
  
          renderCustomers();
          renderCustomerOptions();
          renderManager();
  
          showToast("Pelanggan berhasil dihapus.");
        },
        "Hapus Pelanggan",
        "Hapus"
      );
    }
  });
  
  
  /* =====================================================
     18. MODAL INPUT TEKS KUSTOM
     ===================================================== */
  
  function openTextEditor(title, label, value, onSave) {
    $("chartDetailTitle").textContent = title;
  
    $("chartDetailContent").innerHTML = `
      <div class="field">
        <label for="textEditorInput">${escapeHTML(label)}</label>
        <input id="textEditorInput" type="text"
          value="${escapeHTML(value)}">
      </div>
      <div class="modal-footer">
        <button class="btn secondary" id="textEditorCancel"
          type="button">Batal</button>
        <button class="btn primary" id="textEditorSave"
          type="button">Simpan</button>
      </div>
    `;
  
    $("chartDetailModal").classList.remove("hidden");
  
    $("textEditorCancel").addEventListener("click", () => {
      $("chartDetailModal").classList.add("hidden");
    });
  
    $("textEditorSave").addEventListener("click", async () => {
      const input = $("textEditorInput");
      const newValue = input.value;
  
      try {
        await onSave(newValue);
        $("chartDetailModal").classList.add("hidden");
      } catch (error) {
        showToast(firebaseErrorMessage(error), "error");
      }
    });
  }
  
  
 
/* =====================================================
   19. KATEGORI - FIRESTORE
   ===================================================== */

function findCategory(name) {
    const normalized = normalizeName(name).toLowerCase();
  
    return categories.find(category =>
      normalizeName(category.name).toLowerCase() === normalized
    );
  }
  
  function getSortedCategories() {
    const hasOrder = categories.every(category =>
      Number.isFinite(category.order)
    );
  
    return [...categories].sort((a, b) => {
      if (hasOrder) return a.order - b.order;
      return a.name.localeCompare(b.name, "id");
    });
  }
  
  async function addCategory(name, price) {
    name = normalizeName(name);
    price = Number(price);
  
    if (!name || !Number.isFinite(price) || price < 0) {
      throw new Error("Nama atau harga kategori tidak valid.");
    }
  
    const existing = findCategory(name);
    if (existing) return existing;
  
    const data = {
      name,
      price,
      createdAt: serverTimestamp()
    };
  
    if (categories.every(category =>
      Number.isFinite(category.order)
    )) {
      data.order = Math.max(
        -1,
        ...categories.map(category => category.order)
      ) + 1;
    }
  
    const reference = await addDoc(
      userCollection("categories"),
      data
    );
  
    const saved = {
      id: reference.id,
      ...data
    };
  
    categories.push(saved);
    return saved;
  }
  
  function categoryPrice(name) {
    const category = findCategory(name);
    return category ? Number(category.price) : 0;
  }
  
  function renderCategories() {
    const body = $("categoryList");
    const sorted = getSortedCategories();
  
    if (!sorted.length) {
      body.innerHTML = `
        <tr>
          <td colspan="4" class="empty-state">
            Belum ada kategori barang.
          </td>
        </tr>
      `;
      return;
    }
  
    body.innerHTML = sorted.map((category, index) => `
      <tr>
        <td>${index + 1}</td>
        <td style="text-align:left">
          ${escapeHTML(category.name)}
        </td>
        <td>${rupiah(category.price)}</td>
        <td>
          <div class="action-buttons">
            <button class="btn small secondary"
              data-category-up="${category.id}"
              ${index === 0 ? "disabled" : ""}>
              ↑
            </button>
  
            <button class="btn small secondary"
              data-category-down="${category.id}"
              ${index === sorted.length - 1 ? "disabled" : ""}>
              ↓
            </button>
  
            <button class="btn small secondary"
              data-category-edit="${category.id}">
              Ubah
            </button>
  
            <button class="btn small danger"
              data-category-delete="${category.id}">
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  }
  
  async function moveCategory(categoryId, direction) {
    const sorted = getSortedCategories();
    const index = sorted.findIndex(item => item.id === categoryId);
    const target = index + direction;
  
    if (index < 0 || target < 0 || target >= sorted.length) {
      return;
    }
  
    const previous = categories.map(item => ({ ...item }));
  
    [sorted[index], sorted[target]] =
      [sorted[target], sorted[index]];
  
    categories = sorted.map((item, position) => ({
      ...item,
      order: position
    }));
  
    renderCategories();
  
    try {
      const batch = writeBatch(db);
  
      categories.forEach(category => {
        batch.update(
          userDocument("categories", category.id),
          {
            order: category.order,
            updatedAt: serverTimestamp()
          }
        );
      });
  
      await batch.commit();
  
    } catch (error) {
      categories = previous;
      renderCategories();
      showToast(firebaseErrorMessage(error), "error");
    }
  }
  
  function resetCategoryForm() {
    editingCategory = null;
    $("categoryForm").reset();
  
    $("categoryFormTitle").textContent = "Tambah Kategori";
    $("cancelCategory").classList.add("hidden");
  }
  
  $("categoryForm").addEventListener("submit", async event => {
    event.preventDefault();
  
    const name = normalizeName($("categoryName").value);
    const price = Number($("categoryPrice").value);
  
    if (!name || !Number.isFinite(price) || price < 0) {
      showToast("Periksa nama dan harga kategori.", "error");
      return;
    }
  
    const duplicate = categories.find(category =>
      category.id !== editingCategory &&
      category.name.toLowerCase() === name.toLowerCase()
    );
  
    if (duplicate) {
      showToast("Kategori sudah terdaftar.", "error");
      return;
    }
  
    try {
      if (editingCategory) {
        await updateDoc(
          userDocument("categories", editingCategory),
          {
            name,
            price,
            updatedAt: serverTimestamp()
          }
        );
  
        const category = categories.find(item =>
          item.id === editingCategory
        );
  
        if (category) {
          category.name = name;
          category.price = price;
        }
  
        showToast("Kategori berhasil diperbarui.");
  
      } else {
        await addCategory(name, price);
        showToast("Kategori berhasil ditambahkan.");
      }
  
      resetCategoryForm();
      renderCategories();
  
    } catch (error) {
      showToast(firebaseErrorMessage(error), "error");
    }
  });
  
  $("cancelCategory").addEventListener("click", resetCategoryForm);
  
  $("categoryList").addEventListener("click", async event => {
    const button = event.target.closest("button");
    if (!button) return;
  
    const upId = button.dataset.categoryUp;
    const downId = button.dataset.categoryDown;
    const editId = button.dataset.categoryEdit;
    const deleteId = button.dataset.categoryDelete;
  
    if (upId) {
      await moveCategory(upId, -1);
      return;
    }
  
    if (downId) {
      await moveCategory(downId, 1);
      return;
    }
  
    if (editId) {
      const category = categories.find(item => item.id === editId);
      if (!category) return;
  
      editingCategory = editId;
  
      $("categoryName").value = category.name;
      $("categoryPrice").value = category.price;
  
      $("categoryFormTitle").textContent = "Ubah Kategori";
      $("cancelCategory").classList.remove("hidden");
  
      $("categoryName").focus();
      return;
    }
  
    if (deleteId) {
      const category = categories.find(item => item.id === deleteId);
      if (!category) return;
  
      askConfirmation(
        `Hapus kategori "${category.name}"? Rincian nota lama tidak akan dihapus.`,
        async () => {
          await deleteDoc(userDocument("categories", deleteId));
  
          categories = categories.filter(item =>
            item.id !== deleteId
          );
  
          renderCategories();
          showToast("Kategori berhasil dihapus.");
        },
        "Hapus Kategori",
        "Hapus"
      );
    }
  });
  
  
  /* =====================================================
     20. DROPDOWN KATEGORI BARANG
     ===================================================== */
  
 
function categoryOptions(selected = "") {
    return `<option value="">Pilih kategori</option>` +
      getSortedCategories().map(category => `
        <option value="${escapeHTML(category.name)}"
          ${category.name === selected ? "selected" : ""}>
          ${escapeHTML(category.name)}
        </option>
      `).join("") +
      `<option value="__other__"
        ${selected === "__other__" ? "selected" : ""}>
        ＋ Tambah kategori baru
      </option>`;
  }
  
  
  /* =====================================================
     21. MENAMBAHKAN KATEGORI BARU DARI BARIS NOTA
     ===================================================== */
  
  async function ensureCustomCategory(name, price) {
    name = normalizeName(name);
  
    if (!name) {
      throw new Error("Masukkan nama kategori baru.");
    }
  
    const existing = findCategory(name);
  
    if (existing) {
      return existing;
    }
  
    return await addCategory(name, price);
  }

/* =====================================================
   22. BARIS BARANG NOTA
   ===================================================== */

   function createItemRow(item = {}) {
    const row = document.createElement("tr");
  
    row.innerHTML = `
      <td class="row-number"></td>
  
      <td>
        <input class="item-name" type="text"
          placeholder="Nama barang"
          value="${escapeHTML(item.name || "")}">
      </td>
  
      <td>
        <div class="custom-category-fields">
          <select class="category-select">
            ${categoryOptions(item.category || "")}
          </select>
  
          <input class="custom-category-name hidden"
            type="text"
            placeholder="Nama kategori baru">
  
          <input class="custom-category-price hidden"
            type="number"
            min="0"
            step="1"
            placeholder="Harga kategori">
        </div>
      </td>
  
      <td>
        <input class="item-qty"
          type="number"
          min="1"
          step="1"
          value="${item.qty ?? ""}">
      </td>
  
      <td>
        <input class="item-price"
          type="number"
          min="0"
          step="1"
          value="${item.price ?? 0}">
      </td>
  
      <td class="item-subtotal">
        ${rupiah(
          (Number(item.qty) || 0) *
          (Number(item.price) || 0)
        )}
      </td>
  
      <td>
        <button type="button"
          class="btn small danger remove-row">×</button>
      </td>
    `;
  
    const select = row.querySelector(".category-select");
    const customName = row.querySelector(".custom-category-name");
    const customPrice = row.querySelector(".custom-category-price");
    const priceInput = row.querySelector(".item-price");
  
    select.addEventListener("change", () => {
      const isOther = select.value === "__other__";
  
      customName.classList.toggle("hidden", !isOther);
      customPrice.classList.toggle("hidden", !isOther);
  
      if (isOther) {
        customName.value = "";
        customPrice.value = "";
        priceInput.value = 0;
        customName.focus();
      } else {
        priceInput.value = categoryPrice(select.value);
      }
  
      calculateInvoice();
    });
  
    customPrice.addEventListener("input", () => {
      priceInput.value = Number(customPrice.value) || 0;
      calculateInvoice();
    });
  
    row.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", calculateInvoice);
    });
  
    row.querySelector(".remove-row").addEventListener("click", () => {
      row.remove();
      renumberRows();
      calculateInvoice();
    });
  
    if (item.category && !findCategory(item.category)) {
      select.value = "__other__";
  
      customName.classList.remove("hidden");
      customPrice.classList.remove("hidden");
  
      customName.value = item.category;
      customPrice.value = Number(item.price) || 0;
    }
  
    $("itemRows").appendChild(row);
  
    renumberRows();
    calculateInvoice();
  
    return row;
  }
  
  
  function renumberRows() {
    document.querySelectorAll("#itemRows tr").forEach((row, index) => {
      row.querySelector(".row-number").textContent = index + 1;
    });
  }
  
  
  function readRows(container = $("itemRows")) {
    const result = [];
  
    container.querySelectorAll("tr").forEach(row => {
      const name = normalizeName(
        row.querySelector(".item-name").value
      );
  
      const select = row.querySelector(".category-select");
      const customName = row.querySelector(".custom-category-name");
  
      const category = select.value === "__other__"
        ? normalizeName(customName.value)
        : normalizeName(select.value);
  
      const qty = Number(row.querySelector(".item-qty").value) || 0;
      const price = Number(row.querySelector(".item-price").value) || 0;
  
      if (name || category || qty || price) {
        result.push({
          name,
          category,
          qty,
          price,
          subtotal: qty * price
        });
      }
    });
  
    return result;
  }
  
  
  function calculateInvoice() {
    const rows = readRows();
  
    const totalQty = rows.reduce(
      (sum, item) => sum + item.qty,
      0
    );
  
    const total = rows.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );
  
    document.querySelectorAll("#itemRows tr").forEach(row => {
      const qty = Number(row.querySelector(".item-qty").value) || 0;
      const price = Number(row.querySelector(".item-price").value) || 0;
  
      row.querySelector(".item-subtotal").textContent =
        rupiah(qty * price);
    });
  
    $("totalItem").textContent = rows.length;
    $("totalQty").textContent = totalQty;
    $("grandTotal").textContent = rupiah(total);
  }
  
  
  function addEmptyRow() {
    return createItemRow();
  }
  
  
  $("addRow").addEventListener("click", () => {
    addEmptyRow();
  });
  
  
  $("clearRows").addEventListener("click", () => {
    if (!$("itemRows").children.length) return;
  
    askConfirmation(
      "Hapus seluruh baris barang?",
      () => {
        $("itemRows").innerHTML = "";
        addEmptyRow();
        calculateInvoice();
      },
      "Hapus Rincian",
      "Hapus"
    );
  });
  
  
  function resetInvoiceForm() {
    $("judul").value = "";
    $("tanggalNota").value = localDate();
  
    $("pelangganNota").value = "";
    $("pelangganBaru").value = "";
    $("pelangganBaru").classList.add("hidden");
  
    $("itemRows").innerHTML = "";
  
    addEmptyRow();
    calculateInvoice();
  }
  
  
  /* =====================================================
     SHORTCUT KEYBOARD - BUAT NOTA
     ===================================================== */
$("itemRows").addEventListener("keydown", event => {
    const target = event.target;
  
    if (!$("page-buat").classList.contains("active")) return;
  
    // CTRL + A
    if (
      event.ctrlKey &&
      event.key.toLowerCase() === "a" &&
      target.matches('input[type="text"], textarea')
    ) {
      event.preventDefault();
      target.select();
      return;
    }
  
    if (event.key !== "Enter") return;
  
    const row = target.closest("tr");
    if (!row) return;
  
    const nameInput = row.querySelector(".item-name");
    const categorySelect = row.querySelector(".category-select");
    const customName = row.querySelector(".custom-category-name");
    const customPrice = row.querySelector(".custom-category-price");
    const quantityInput = row.querySelector(".item-qty");
  
    // NAMA BARANG -> BUKA PILIHAN KATEGORI
    if (target === nameInput) {
      event.preventDefault();
      categorySelect.focus();
  
      // Membuka dropdown kategori secara otomatis.
      categorySelect.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true })
      );
  
      return;
    }
  
    // KATEGORI -> JUMLAH
    if (target === categorySelect) {
      event.preventDefault();
  
      if (categorySelect.value === "__other__") {
        customName.focus();
      } else {
        quantityInput.focus();
        quantityInput.select();
      }
  
      return;
    }
  
    // NAMA KATEGORI BARU -> HARGA
    if (target === customName) {
      event.preventDefault();
      customPrice.focus();
      customPrice.select();
      return;
    }
  
    // HARGA KATEGORI -> JUMLAH
    if (target === customPrice) {
      event.preventDefault();
      quantityInput.focus();
      quantityInput.select();
      return;
    }
  
    // JUMLAH -> BARIS BARU
    if (target === quantityInput) {
      event.preventDefault();
  
      const newRow = addEmptyRow();
      newRow.querySelector(".item-name").focus();
    }
  });
  
  /* =====================================================
     23. VALIDASI NOTA
     ===================================================== */
  
  function validateInvoice(customer, items) {
    if (!customer) {
      showToast("Pilih atau masukkan nama pelanggan.", "error");
      return false;
    }
  
    if (!items.length) {
      showToast("Tambahkan minimal satu barang.", "error");
      return false;
    }
  
    for (const item of items) {
      if (!item.name) {
        showToast("Nama barang belum diisi.", "error");
        return false;
      }
  
      if (!item.category) {
        showToast("Kategori barang belum dipilih.", "error");
        return false;
      }
  
      if (item.qty <= 0) {
        showToast("Jumlah barang harus lebih dari nol.", "error");
        return false;
      }
  
      if (item.price < 0) {
        showToast("Harga barang tidak boleh negatif.", "error");
        return false;
      }
    }
  
    return true;
  }
  
  
  /* =====================================================
     24. SIMPAN NOTA KE FIRESTORE
     ===================================================== */
  
  async function saveNewInvoice() {
    const customer = currentInvoiceCustomer();
    const items = readRows();
  
    if (!validateInvoice(customer, items)) return;
  
    askConfirmation(
      "Simpan nota dan seluruh rincian transaksi?",
      async () => {
        const button = $("saveInvoice");
  
        button.disabled = true;
        button.textContent = "Menyimpan...";
  
        try {
          await addCustomer(customer);
  
          // Simpan kategori khusus yang belum terdaftar.
          for (const item of items) {
            if (!findCategory(item.category)) {
              await ensureCustomCategory(
                item.category,
                item.price
              );
            }
          }
  
          const total = items.reduce(
            (sum, item) => sum + item.subtotal,
            0
          );
  
          const invoiceData = {
            number: await generateInvoiceNumber(),
            title: normalizeName($("judul").value),
            customer,
            date: $("tanggalNota").value || localDate(),
            items,
            total,
            createdAt: serverTimestamp()
          };
  
          const reference = await addDoc(
            userCollection("invoices"),
            invoiceData
          );
  
          invoices.push({
            id: reference.id,
            ...invoiceData,
            createdAt: new Date().toISOString()
          });
  
          renderCustomerOptions();
          renderCustomers();
          renderCategories();
          renderManager();
  
          resetInvoiceForm();
  
          showToast("Nota berhasil disimpan.");
  
        } catch (error) {
          showToast(firebaseErrorMessage(error), "error");
        } finally {
          button.disabled = false;
          button.textContent = "Simpan Nota";
        }
      },
      "Simpan Nota",
      "Simpan"
    );
  }
  
  async function generateInvoiceNumber() {
    const counterRef = doc(
      db,
      "users",
      currentUser.uid,
      "settings",
      "counter"
    );
  
    const snapshot = await getDoc(counterRef);
  
    let nextNumber = 1;
  
    if (snapshot.exists()) {
      nextNumber = Number(snapshot.data().value || 0) + 1;
    }
  
    await setDoc(counterRef, {
      value: nextNumber,
      updatedAt: serverTimestamp()
    });
  
    return `NOTA-${String(nextNumber).padStart(5, "0")}`;
  }
  
  $("saveInvoice").addEventListener("click", saveNewInvoice);
  
  $("resetInvoice").addEventListener("click", () => {
    askConfirmation(
      "Bersihkan seluruh isian nota?",
      resetInvoiceForm,
      "Bersihkan Nota",
      "Bersihkan"
    );
  });
  
  
  /* =====================================================
     25. NOTA MANAGER
     ===================================================== */
  
  function getInvoiceTotal(invoice) {
    if (Number.isFinite(Number(invoice.total))) {
      return Number(invoice.total);
    }
  
    return (invoice.items || []).reduce((sum, item) => {
      return sum +
        (Number(item.qty) || 0) *
        (Number(item.price) || 0);
    }, 0);
  }
  
  function renderManager(filterCustomer = selectedCustomer) {
    selectedCustomer = filterCustomer;
  
    const search = normalizeName(
      $("searchInvoice").value
    ).toLowerCase();
  
    const customerNames = [...new Set([
      ...customers.map(customer => customer.name),
      ...invoices.map(invoice => invoice.customer).filter(Boolean)
    ])].sort((a, b) => a.localeCompare(b, "id"));
  
    const matchesSearch = invoice => {
      return !search ||
        String(invoice.customer || "").toLowerCase().includes(search) ||
        String(invoice.number || "").toLowerCase().includes(search) ||
        String(invoice.title || "").toLowerCase().includes(search);
    };
  
    const allCount = invoices.filter(matchesSearch).length;
  
    $("customerFolders").innerHTML = `
      <button class="folder-item ${
        !filterCustomer ? "selected" : ""
      }" data-folder="">
        <span>▣ Semua Nota</span>
        <small>${allCount}</small>
      </button>
    ` + customerNames.map(name => {
      const count = invoices.filter(invoice =>
        invoice.customer === name && matchesSearch(invoice)
      ).length;
  
      return `
        <button class="folder-item ${
          filterCustomer === name ? "selected" : ""
        }" data-folder="${escapeHTML(name)}">
          <span>📁 ${escapeHTML(name)}</span>
          <small>${count}</small>
        </button>
      `;
    }).join("");
  
    const filtered = invoices
      .filter(invoice =>
        (!filterCustomer || invoice.customer === filterCustomer) &&
        matchesSearch(invoice)
      )
      .sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
      );
  
    $("folderTitle").textContent =
      filterCustomer || "Semua Nota";
  
    $("invoiceCount").textContent =
      `${filtered.length} Nota`;
  
    if (!filtered.length) {
      $("invoiceList").innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">
            Tidak ada nota yang ditemukan.
          </td>
        </tr>
      `;
      return;
    }
  
    $("invoiceList").innerHTML = filtered.map(invoice => `
      <tr>
        <td>${escapeHTML(invoice.number || "-")}</td>
        <td>${escapeHTML(invoice.title || "-")}</td>
        <td>${formatDate(invoice.date)}</td>
        <td>${rupiah(getInvoiceTotal(invoice))}</td>
        <td>
          <div class="action-buttons">
            <button class="btn small secondary"
              data-preview="${invoice.id}">Lihat</button>
            <button class="btn small secondary"
              data-edit="${invoice.id}">Ubah</button>
            <button class="btn small danger"
              data-delete="${invoice.id}">Hapus</button>
          </div>
        </td>
      </tr>
    `).join("");
  }
  
  $("customerFolders").addEventListener("click", event => {
    const button = event.target.closest("[data-folder]");
    if (!button) return;
  
    selectedCustomer = button.dataset.folder || null;
    renderManager(selectedCustomer);
  });
  
  $("showAllInvoices").addEventListener("click", () => {
    selectedCustomer = null;
    $("searchInvoice").value = "";
    renderManager(null);
  });
  
  $("searchInvoice").addEventListener("input", () => {
    renderManager(selectedCustomer);
  });
  
  $("invoiceList").addEventListener("click", event => {
    const previewId = event.target.dataset.preview;
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
  
    if (previewId) openPreview(previewId);
    if (editId) openEdit(editId);
  
    if (deleteId) {
      const invoice = invoices.find(item => item.id === deleteId);
      if (!invoice) return;
  
      askConfirmation(
        `Hapus nota ${invoice.number}? Tindakan ini tidak dapat dibatalkan.`,
        async () => {
          await deleteDoc(userDocument("invoices", deleteId));
  
          invoices = invoices.filter(item => item.id !== deleteId);
  
          renderManager();
          showToast("Nota berhasil dihapus.");
        },
        "Hapus Nota",
        "Hapus"
      );
    }
  });
  
  
  /* =====================================================
     26. PREVIEW NOTA
     ===================================================== */
  
  function openPreview(id) {
    const invoice = invoices.find(item => item.id === id);
    if (!invoice) return;
  
    currentPreview = invoice;
  
    $("previewContent").innerHTML = `
      <div class="receipt">
        <h2>NOTA PEMBELIAN</h2>
        <p class="receipt-title">
          ${escapeHTML(invoice.title || "Nota Transaksi")}
        </p>
  
        <div class="receipt-info">
          <div><strong>No. Nota:</strong>
            ${escapeHTML(invoice.number || "-")}
          </div>
          <div><strong>Tanggal:</strong>
            ${formatDate(invoice.date)}
          </div>
          <div><strong>Pelanggan:</strong>
            ${escapeHTML(invoice.customer || "-")}
          </div>
        </div>
  
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Nama Barang</th>
              <th>Kategori</th>
              <th>Jumlah</th>
              <th>Harga</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.items || []).map((item, index) => `
              <tr>
                <td>${index + 1}</td>
                <td style="text-align:left">
                  ${escapeHTML(item.name)}
                </td>
                <td>${escapeHTML(item.category)}</td>
                <td>${Number(item.qty) || 0}</td>
                <td>${rupiah(item.price)}</td>
                <td>${rupiah(item.subtotal)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
  
        <div class="receipt-total">
          TOTAL: ${rupiah(getInvoiceTotal(invoice))}
        </div>
  
        <div class="receipt-footer">
          Terima kasih atas kepercayaan Anda.
        </div>
      </div>
    `;
  
    $("previewModal").classList.remove("hidden");
  }
  
  $("printInvoice").addEventListener("click", () => {
    window.print();
  });
  
  
  /* =====================================================
     27. EDIT NOTA
     ===================================================== */
  
  
function editCategoryOptions(selected = "") {
    return `<option value="">Pilih kategori</option>` +
      getSortedCategories().map(category => `
        <option value="${escapeHTML(category.name)}"
          ${category.name === selected ? "selected" : ""}>
          ${escapeHTML(category.name)}
        </option>
      `).join("") +
      `<option value="__other__">＋ Tambah kategori baru</option>`;
  }
  
  
  function openEdit(id) {
    const invoice = invoices.find(item => item.id === id);
    if (!invoice) return;
  
    editingInvoiceId = id;
  
    const savedCustomer = !!findCustomer(invoice.customer);
  
    $("editContent").innerHTML = `
      <div class="form-grid">
        <div class="field">
          <label for="editTitle">Judul Nota</label>
          <input id="editTitle" type="text"
            value="${escapeHTML(invoice.title || "")}">
        </div>
  
        <div class="field">
          <label for="editCustomer">Pelanggan</label>
          <select id="editCustomer">
            <option value="">Pilih pelanggan</option>
            ${customers.map(customer => `
              <option value="${escapeHTML(customer.name)}"
                ${customer.name === invoice.customer ? "selected" : ""}>
                ${escapeHTML(customer.name)}
              </option>
            `).join("")}
            <option value="__other__"
              ${savedCustomer ? "" : "selected"}>
              ＋ Tambah pelanggan baru
            </option>
          </select>
  
          <input id="editCustomerOther"
            class="${savedCustomer ? "hidden" : ""}"
            type="text"
            placeholder="Nama pelanggan baru"
            value="${savedCustomer ? "" : escapeHTML(invoice.customer)}">
        </div>
  
        <div class="field">
          <label for="editDate">Tanggal</label>
          <input id="editDate" type="date"
            value="${escapeHTML(invoice.date || localDate())}">
        </div>
      </div>
  
      <div class="section-title">
        <h2>Rincian Barang</h2>
      </div>
  
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>No.</th>
              <th>Nama Barang</th>
              <th>Kategori</th>
              <th>Jumlah</th>
              <th>Harga</th>
              <th>Subtotal</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody id="editItemRows"></tbody>
        </table>
      </div>
  
      <div class="table-actions">
        <button class="btn secondary" id="editAddRow" type="button">
          ＋ Tambah Baris
        </button>
      </div>
  
      <div class="receipt-total">
        Total: <span id="editGrandTotal">
          ${rupiah(getInvoiceTotal(invoice))}
        </span>
      </div>
    `;
  
    $("editCustomer").addEventListener("change", () => {
      const other = $("editCustomer").value === "__other__";
  
      $("editCustomerOther").classList.toggle("hidden", !other);
  
      if (other) {
        $("editCustomerOther").focus();
      }
    });
  
    (invoice.items || []).forEach(item => createEditItemRow(item));
  
    if (!(invoice.items || []).length) {
      createEditItemRow();
    }
  
    $("editAddRow").addEventListener("click", () => {
      createEditItemRow();
    });
  
    $("editModal").classList.remove("hidden");
  }
  
  function createEditItemRow(item = {}) {
    const row = document.createElement("tr");
  
    row.innerHTML = `
      <td class="row-number"></td>
      <td>
        <input class="item-name" type="text"
          placeholder="Nama barang"
          value="${escapeHTML(item.name || "")}">
      </td>
      <td>
        <div class="custom-category-fields">
          <select class="category-select">
            ${editCategoryOptions(item.category || "")}
          </select>
          <input class="custom-category-name hidden"
            type="text" placeholder="Nama kategori baru">
          <input class="custom-category-price hidden"
            type="number" min="0" placeholder="Harga kategori">
        </div>
      </td>
      <td>
        <input class="item-qty" type="number"
          min="1" value="${item.qty ?? ""}">
      </td>
      <td>
        <input class="item-price" type="number"
          min="0" value="${Number(item.price) || 0}">
      </td>
      <td class="item-subtotal">${rupiah(
        (Number(item.qty) || 0) * (Number(item.price) || 0)
      )}</td>
      <td>
        <button type="button" class="btn small danger remove-row">×</button>
      </td>
    `;
  
    const select = row.querySelector(".category-select");
    const customName = row.querySelector(".custom-category-name");
    const customPrice = row.querySelector(".custom-category-price");
    const priceInput = row.querySelector(".item-price");
  
    select.addEventListener("change", () => {
      const other = select.value === "__other__";
  
      customName.classList.toggle("hidden", !other);
      customPrice.classList.toggle("hidden", !other);
  
      if (other) {
        customName.value = "";
        customPrice.value = "";
        priceInput.value = 0;
        customName.focus();
      } else {
        priceInput.value = categoryPrice(select.value);
      }
  
      calculateEditTotal();
    });
  
    customPrice.addEventListener("input", () => {
      priceInput.value = Number(customPrice.value) || 0;
      calculateEditTotal();
    });
  
    row.querySelectorAll("input").forEach(input => {
      input.addEventListener("input", calculateEditTotal);
    });
  
    row.querySelector(".remove-row").addEventListener("click", () => {
      row.remove();
      renumberEditRows();
      calculateEditTotal();
    });
  
    if (item.category && !findCategory(item.category)) {
      select.value = "__other__";
      customName.classList.remove("hidden");
      customPrice.classList.remove("hidden");
      customName.value = item.category;
      customPrice.value = Number(item.price) || 0;
    }
  
    $("editItemRows").appendChild(row);
  
    renumberEditRows();
    calculateEditTotal();
  }
  
  function renumberEditRows() {
    document.querySelectorAll("#editItemRows tr")
      .forEach((row, index) => {
        row.querySelector(".row-number").textContent = index + 1;
      });
  }
  
  function calculateEditTotal() {
    let total = 0;
  
    document.querySelectorAll("#editItemRows tr")
      .forEach(row => {
        const qty = Number(row.querySelector(".item-qty").value) || 0;
        const price = Number(row.querySelector(".item-price").value) || 0;
        const subtotal = qty * price;
  
        row.querySelector(".item-subtotal").textContent =
          rupiah(subtotal);
  
        total += subtotal;
      });
  
    $("editGrandTotal").textContent = rupiah(total);
  }
  
  $("confirmEdit").addEventListener("click", () => {
    const invoice = invoices.find(item =>
      item.id === editingInvoiceId
    );
  
    if (!invoice) return;
  
    const customer = normalizeName(
      $("editCustomer").value === "__other__"
        ? $("editCustomerOther").value
        : $("editCustomer").value
    );
  
    const items = [];
  
    document.querySelectorAll("#editItemRows tr")
      .forEach(row => {
        const name = normalizeName(
          row.querySelector(".item-name").value
        );
  
        const select = row.querySelector(".category-select");
        const customName = row.querySelector(".custom-category-name");
  
        const category = select.value === "__other__"
          ? normalizeName(customName.value)
          : normalizeName(select.value);
  
        const qty = Number(row.querySelector(".item-qty").value) || 0;
        const price = Number(row.querySelector(".item-price").value) || 0;
  
        if (name || category || qty || price) {
          items.push({
            name,
            category,
            qty,
            price,
            subtotal: qty * price
          });
        }
      });
  
    if (!validateInvoice(customer, items)) return;
  
    askConfirmation(
      "Simpan perubahan nota ini?",
      async () => {
        const button = $("confirmEdit");
        button.disabled = true;
  
        try {
          await addCustomer(customer);
  
          for (const item of items) {
            if (!findCategory(item.category)) {
              await ensureCustomCategory(
                item.category,
                item.price
              );
            }
          }
  
          const updated = {
            title: normalizeName($("editTitle").value),
            customer,
            date: $("editDate").value || localDate(),
            items,
            total: items.reduce(
              (sum, item) => sum + item.subtotal,
              0
            ),
            updatedAt: serverTimestamp()
          };
  
          await updateDoc(
            userDocument("invoices", invoice.id),
            updated
          );
  
          Object.assign(invoice, {
            ...updated,
            updatedAt: new Date().toISOString()
          });
  
          $("editModal").classList.add("hidden");
          editingInvoiceId = null;
  
          renderManager();
          renderCustomers();
          renderCategories();
          renderCustomerOptions();
  
          showToast("Nota berhasil diperbarui.");
  
        } catch (error) {
          showToast(firebaseErrorMessage(error), "error");
        } finally {
          button.disabled = false;
        }
      },
      "Simpan Perubahan",
      "Simpan"
    );
  });
  
  
  /* =====================================================
     28. ANALISA PENJUALAN
     ===================================================== */
  
  function getInvoiceDate(invoice) {
    const value = String(invoice.date || "");
  
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? value
      : "";
  }
  
  function formatShortDate(date) {
    const parts = date.split("-");
    return `${parts[2]}/${parts[1]}`;
  }
  
  function getStartOfWeek(date) {
    const result = new Date(date);
    const day = result.getDay();
  
    result.setDate(result.getDate() - ((day + 6) % 7));
    result.setHours(0, 0, 0, 0);
  
    return result;
  }
  
  function dateKey(date) {
    return localDate(date);
  }
  
  function getSalesSeries(period) {
    const today = new Date();
    const labels = [];
    const values = [];
  
    if (period === "daily") {
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
  
        const key = dateKey(date);
  
        labels.push(formatShortDate(key));
  
        values.push(
          invoices
            .filter(invoice => getInvoiceDate(invoice) === key)
            .reduce((sum, invoice) =>
              sum + getInvoiceTotal(invoice), 0)
        );
      }
    }
  
    if (period === "weekly") {
      const currentWeek = getStartOfWeek(today);
  
      for (let i = 11; i >= 0; i--) {
        const start = new Date(currentWeek);
        start.setDate(currentWeek.getDate() - i * 7);
  
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
  
        const startKey = dateKey(start);
        const endKey = dateKey(end);
  
        labels.push(formatShortDate(startKey));
  
        const total = invoices
          .filter(invoice => {
            const date = getInvoiceDate(invoice);
            return date >= startKey && date <= endKey;
          })
          .reduce((sum, invoice) =>
            sum + getInvoiceTotal(invoice), 0);
  
        values.push(total);
      }
    }
  
    if (period === "monthly") {
      for (let i = 11; i >= 0; i--) {
        const date = new Date(
          today.getFullYear(),
          today.getMonth() - i,
          1
        );
  
        const year = date.getFullYear();
        const month = date.getMonth();
  
        labels.push(date.toLocaleDateString("id-ID", {
          month: "short",
          year: "2-digit"
        }));
  
        const total = invoices
          .filter(invoice => {
            const key = getInvoiceDate(invoice);
            if (!key) return false;
  
            const [invoiceYear, invoiceMonth] =
              key.split("-").map(Number);
  
            return invoiceYear === year &&
              invoiceMonth === month + 1;
          })
          .reduce((sum, invoice) =>
            sum + getInvoiceTotal(invoice), 0);
  
        values.push(total);
      }
    }
  
    return { labels, values };
  }
  
  
  /* =====================================================
     29. GRAFIK BATANG
     ===================================================== */
  
  function drawBarChart(canvas, labels, values) {
    if (!canvas) return;
  
    const rect = canvas.getBoundingClientRect();
  
    const width = Math.max(280, rect.width);
    const height = Math.max(200, rect.height);
    const dpr = window.devicePixelRatio || 1;
  
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  
    const ctx = canvas.getContext("2d");
  
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
  
    const margin = {
      top: 20,
      right: 15,
      bottom: 42,
      left: 65
    };
  
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
  
    const maxValue = Math.max(...values, 1);
    const roundedMax = Math.ceil(maxValue / 5) * 5 || 5;
  
    ctx.font = "11px Segoe UI";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
  
    for (let i = 0; i <= 5; i++) {
      const value = roundedMax * i / 5;
  
      const y = margin.top +
        chartHeight -
        chartHeight * i / 5;
  
      ctx.strokeStyle = "#e6ebf0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();
  
      ctx.fillStyle = "#778493";
  
      const label = value >= 1000000
        ? `${(value / 1000000).toFixed(1)}jt`
        : value >= 1000
          ? `${Math.round(value / 1000)}rb`
          : String(Math.round(value));
  
      ctx.fillText(label, margin.left - 8, y);
    }
  
    const slotWidth = chartWidth / Math.max(labels.length, 1);
    const barWidth = Math.max(3, Math.min(24, slotWidth * .62));
  
    values.forEach((value, index) => {
      const barHeight = value / roundedMax * chartHeight;
  
      const x = margin.left +
        index * slotWidth +
        (slotWidth - barWidth) / 2;
  
      const y = margin.top + chartHeight - barHeight;
  
      ctx.fillStyle = "#527da5";
      ctx.fillRect(x, y, barWidth, Math.max(0, barHeight));
    });
  
    ctx.fillStyle = "#788493";
    ctx.font = "10px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
  
    const step = labels.length > 20
      ? 5
      : labels.length > 12
        ? 3
        : 1;
  
    labels.forEach((label, index) => {
      if (index % step !== 0 && index !== labels.length - 1) {
        return;
      }
  
      const x = margin.left +
        index * slotWidth +
        slotWidth / 2;
  
      ctx.fillText(
        label,
        x,
        margin.top + chartHeight + 9
      );
    });
  }
  
  
  /* =====================================================
     30. DATA DIAGRAM PELANGGAN DAN KATEGORI
     ===================================================== */
  
  function getCustomerSales() {
    const totals = {};
  
    invoices.forEach(invoice => {
      const name = invoice.customer || "Tanpa pelanggan";
  
      totals[name] = (totals[name] || 0) +
        getInvoiceTotal(invoice);
    });
  
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }
  
  function getCategorySales() {
    const totals = {};
  
    invoices.forEach(invoice => {
      (invoice.items || []).forEach(item => {
        const name = item.category || "Tanpa kategori";
  
        const value = Number(item.subtotal) ||
          (Number(item.qty) || 0) *
          (Number(item.price) || 0);
  
        totals[name] = (totals[name] || 0) + value;
      });
    });
  
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }
  
  
  /* =====================================================
     31. GAMBAR DIAGRAM DONAT INTERAKTIF
     ===================================================== */
  
  function drawDonutChart(canvas, entries, type) {
    if (!canvas) return;
  
    const rect = canvas.getBoundingClientRect();
  
    const width = Math.max(180, rect.width);
    const height = Math.max(180, rect.height);
    const dpr = window.devicePixelRatio || 1;
  
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  
    const ctx = canvas.getContext("2d");
  
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
  
    const total = entries.reduce(
      (sum, entry) => sum + entry.value,
      0
    );
  
    const centerX = width / 2;
    const centerY = height / 2;
  
    const radius = Math.min(width, height) * .34;
    const lineWidth = Math.min(25, radius * .38);
  
    canvas._donut = {
      entries,
      type,
      total,
      centerX,
      centerY,
      radius,
      lineWidth
    };
  
    if (!total) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  
      ctx.strokeStyle = "#e5eaf0";
      ctx.lineWidth = lineWidth;
      ctx.stroke();
  
      ctx.fillStyle = "#263b52";
      ctx.font = "bold 13px Segoe UI";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Belum ada data", centerX, centerY);
  
      return;
    }
  
    let startAngle = -Math.PI / 2;
  
    entries.forEach((entry, index) => {
      const angle = entry.value / total * Math.PI * 2;
  
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        radius,
        startAngle,
        startAngle + angle
      );
  
      ctx.strokeStyle =
        CHART_COLORS[index % CHART_COLORS.length];
  
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "butt";
      ctx.stroke();
  
      startAngle += angle;
    });
  
    ctx.fillStyle = "#263b52";
    ctx.font = "bold 14px Segoe UI";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  
    const centerText = total >= 1000000
      ? `${(total / 1000000).toFixed(1)}jt`
      : total >= 1000
        ? `${(total / 1000).toFixed(1)}rb`
        : rupiah(total);
  
    ctx.fillText(centerText, centerX, centerY);
  }
  
  
  /* =====================================================
     32. KLIK DIAGRAM DONAT
     ===================================================== */
  
  function openChartDetail(type, selectedIndex = null) {
    const entries = type === "customer"
      ? customerChartEntries
      : categoryChartEntries;
  
    const title = type === "customer"
      ? "Rincian Penjualan Pelanggan"
      : "Rincian Penjualan Kategori";
  
    const total = entries.reduce(
      (sum, entry) => sum + entry.value,
      0
    );
  
    $("chartDetailTitle").textContent = title;
  
    const selected = selectedIndex === null
      ? null
      : entries[selectedIndex];
  
    const list = selected
      ? [selected]
      : entries;
  
    if (!entries.length) {
      $("chartDetailContent").innerHTML = `
        <p class="empty-state">Belum ada data penjualan.</p>
      `;
    } else {
      $("chartDetailContent").innerHTML = `
        ${selected ? `
          <div class="settings-preview">
            <strong>${escapeHTML(selected.name)}</strong>
            <p>Nilai penjualan: ${rupiah(selected.value)}</p>
            <p>Persentase: ${
              total ? (selected.value / total * 100).toFixed(1) : 0
            }%</p>
          </div>
          <div style="height:15px"></div>
        ` : ""}
  
        <div class="chart-detail-list">
          ${list.map(entry => {
            const index = entries.indexOf(entry);
  
            return `
              <div class="chart-detail-row">
                <div class="chart-detail-name">
                  <span class="chart-detail-color"
                    style="background:${
                      CHART_COLORS[index % CHART_COLORS.length]
                    }"></span>
                  <span>${escapeHTML(entry.name)}</span>
                </div>
                <div class="chart-detail-value">
                  ${rupiah(entry.value)}
                </div>
              </div>
            `;
          }).join("")}
        </div>
  
        <div class="chart-detail-total">
          <span>Total Penjualan</span>
          <span>${rupiah(total)}</span>
        </div>
      `;
    }
  
    $("chartDetailModal").classList.remove("hidden");
  }
  
  function attachDonutClick(canvas, type) {
    canvas.addEventListener("click", event => {
      const data = canvas._donut;
      if (!data) return;
  
      const rect = canvas.getBoundingClientRect();
  
      const scaleX = canvas.width /
        (window.devicePixelRatio || 1) /
        rect.width;
  
      const scaleY = canvas.height /
        (window.devicePixelRatio || 1) /
        rect.height;
  
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
  
      const dx = x - data.centerX;
      const dy = y - data.centerY;
  
      const distance = Math.sqrt(dx * dx + dy * dy);
  
      // Klik area tengah: tampilkan seluruh data.
      if (distance < data.radius - data.lineWidth / 2) {
        openChartDetail(type, null);
        return;
      }
  
      // Klik di luar cincin: tidak melakukan apa pun.
      if (distance > data.radius + data.lineWidth / 2) {
        return;
      }
  
      let angle = Math.atan2(dy, dx);
  
      if (angle < -Math.PI / 2) {
        angle += Math.PI * 2;
      }
  
      let startAngle = -Math.PI / 2;
      const total = data.total;
  
      for (let index = 0; index < data.entries.length; index++) {
        const entry = data.entries[index];
        const sectionAngle = entry.value / total * Math.PI * 2;
        const endAngle = startAngle + sectionAngle;
  
        if (angle >= startAngle && angle <= endAngle) {
          openChartDetail(type, index);
          return;
        }
  
        startAngle = endAngle;
      }
    });
  }
  
  attachDonutClick($("customerChart"), "customer");
  attachDonutClick($("categoryChart"), "category");
  
  
  /* =====================================================
     33. TAMPILKAN ANALISA
     ===================================================== */
  
  function renderAnalytics() {
    if (!$("page-analisa").classList.contains("active")) {
      return;
    }
  
    const revenue = invoices.reduce(
      (sum, invoice) => sum + getInvoiceTotal(invoice),
      0
    );
  
    const totalItems = invoices.reduce((sum, invoice) => {
      return sum + (invoice.items || []).reduce(
        (itemSum, item) => itemSum + (Number(item.qty) || 0),
        0
      );
    }, 0);
  
    $("statInvoices").textContent = invoices.length;
    $("statRevenue").textContent = rupiah(revenue);
    $("statCustomers").textContent = customers.length;
    $("statItems").textContent = totalItems;
  
    const series = getSalesSeries($("chartPeriod").value);
  
    drawBarChart(
      $("salesChart"),
      series.labels,
      series.values
    );
  
    customerChartEntries = getCustomerSales();
    categoryChartEntries = getCategorySales();
  
    drawDonutChart(
      $("customerChart"),
      customerChartEntries,
      "customer"
    );
  
    drawDonutChart(
      $("categoryChart"),
      categoryChartEntries,
      "category"
    );
  
    renderHistoryAnalytics();
  }
  
  $("chartPeriod").addEventListener("change", renderAnalytics);
  
  
  /* =====================================================
     34. ANALISA HISTORI
     ===================================================== */
  
  function monthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  }
  
  function monthLabel(key) {
    const [year, month] = key.split("-").map(Number);
  
    return new Date(year, month - 1, 1)
      .toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric"
      });
  }
  
  function quarterKey(year, quarter) {
    return `${year}-Q${quarter}`;
  }
  
  function quarterLabel(key) {
    const [year, quarter] = key.split("-Q");
  
    return `Kuartal ${quarter} ${year}`;
  }
  
  function getHistoryOptions(type) {
    const options = new Set();
  
    invoices.forEach(invoice => {
      const date = getInvoiceDate(invoice);
      if (!date) return;
  
      const [year, month] = date.split("-").map(Number);
  
      if (type === "monthly") {
        options.add(monthKey(year, month - 1));
      } else {
        const quarter = Math.floor((month - 1) / 3) + 1;
        options.add(quarterKey(year, quarter));
      }
    });
  
    const now = new Date();
  
    if (type === "monthly") {
      options.add(monthKey(now.getFullYear(), now.getMonth()));
    } else {
      options.add(quarterKey(
        now.getFullYear(),
        Math.floor(now.getMonth() / 3) + 1
      ));
    }
  
    return [...options].sort();
  }
  
  function getHistoryTotal(key, type) {
    return invoices
      .filter(invoice => {
        const date = getInvoiceDate(invoice);
        if (!date) return false;
  
        const [year, month] = date.split("-").map(Number);
  
        if (type === "monthly") {
          return monthKey(year, month - 1) === key;
        }
  
        const quarter = Math.floor((month - 1) / 3) + 1;
  
        return quarterKey(year, quarter) === key;
      })
      .reduce((sum, invoice) =>
        sum + getInvoiceTotal(invoice), 0);
  }
  
  function getHistoryCount(key, type) {
    return invoices.filter(invoice => {
      const date = getInvoiceDate(invoice);
      if (!date) return false;
  
      const [year, month] = date.split("-").map(Number);
  
      if (type === "monthly") {
        return monthKey(year, month - 1) === key;
      }
  
      const quarter = Math.floor((month - 1) / 3) + 1;
  
      return quarterKey(year, quarter) === key;
    }).length;
  }
  
  function getPreviousHistoryKey(key, type) {
    if (type === "monthly") {
      const [year, month] = key.split("-").map(Number);
  
      const date = new Date(year, month - 2, 1);
  
      return monthKey(date.getFullYear(), date.getMonth());
    }
  
    const [yearText, quarterText] = key.split("-Q");
  
    let year = Number(yearText);
    let quarter = Number(quarterText) - 1;
  
    if (quarter < 1) {
      quarter = 4;
      year--;
    }
  
    return quarterKey(year, quarter);
  }
  
  function renderHistoryOptions() {
    const type = $("historyType").value;
    const select = $("historyPeriod");
  
    const previousValue = select.value;
    const options = getHistoryOptions(type).reverse();
  
    const now = new Date();
  
    const currentKey = type === "monthly"
      ? monthKey(now.getFullYear(), now.getMonth())
      : quarterKey(
          now.getFullYear(),
          Math.floor(now.getMonth() / 3) + 1
        );
  
    select.innerHTML = options.map(key => {
      const label = type === "monthly"
        ? monthLabel(key)
        : quarterLabel(key);
  
      return `
        <option value="${key}">
          ${escapeHTML(label)}
        </option>
      `;
    }).join("");
  
    select.value = options.includes(previousValue)
      ? previousValue
      : currentKey;
  }
  
  function renderHistoryAnalytics() {
    if (!$("historyType") || !$("historyPeriod")) return;
  
    renderHistoryOptions();
  
    const type = $("historyType").value;
    const key = $("historyPeriod").value;
  
    if (!key) return;
  
    const previousKey = getPreviousHistoryKey(key, type);
  
    const currentTotal = getHistoryTotal(key, type);
    const previousTotal = getHistoryTotal(previousKey, type);
  
    const currentCount = getHistoryCount(key, type);
  
    const difference = currentTotal - previousTotal;
  
    const growth = previousTotal > 0
      ? difference / previousTotal * 100
      : currentTotal > 0 ? 100 : 0;
  
    $("historyCurrent").textContent = rupiah(currentTotal);
    $("historyPrevious").textContent = rupiah(previousTotal);
    $("historyTransactions").textContent = currentCount;
  
    $("historyGrowth").textContent =
      `${difference > 0 ? "+" : ""}${growth.toFixed(1)}%`;
  
    $("historyGrowth").style.color =
      difference > 0 ? "#2d8a5b" :
      difference < 0 ? "#c94b43" :
      "#263b52";
  
    const maximum = Math.max(currentTotal, previousTotal, 1);
  
    $("previousBar").style.width =
      `${previousTotal / maximum * 100}%`;
  
    $("currentBar").style.width =
      `${currentTotal / maximum * 100}%`;
  
    $("previousLabel").textContent = type === "monthly"
      ? monthLabel(previousKey)
      : quarterLabel(previousKey);
  
    $("currentLabel").textContent = type === "monthly"
      ? monthLabel(key)
      : quarterLabel(key);
  
    $("previousAmount").textContent = rupiah(previousTotal);
    $("currentAmount").textContent = rupiah(currentTotal);
  
    let conclusion;
  
    if (currentTotal === 0 && previousTotal === 0) {
      conclusion =
        "Belum ada transaksi pada kedua periode yang dibandingkan.";
    } else if (currentTotal > previousTotal) {
      conclusion =
        `Penjualan meningkat ${growth.toFixed(1)}% dibandingkan periode sebelumnya. ` +
        `Total periode ini ${rupiah(currentTotal)}.`;
    } else if (currentTotal < previousTotal) {
      conclusion =
        `Penjualan menurun ${Math.abs(growth).toFixed(1)}% dibandingkan periode sebelumnya. ` +
        `Total periode ini ${rupiah(currentTotal)}.`;
    } else {
      conclusion =
        `Penjualan sama dengan periode sebelumnya, yaitu ${rupiah(currentTotal)}.`;
    }
  
    $("historyConclusion").textContent = conclusion;
  }
  
  $("historyType").addEventListener("change", () => {
    renderHistoryOptions();
    renderHistoryAnalytics();
  });
  
  $("historyPeriod").addEventListener(
    "change",
    renderHistoryAnalytics
  );
  
  
  /* =====================================================
     35. RESIZE GRAFIK
     ===================================================== */
  
  window.addEventListener("resize", () => {
    clearTimeout(chartResizeTimer);
  
    chartResizeTimer = setTimeout(() => {
      if ($("page-analisa").classList.contains("active")) {
        renderAnalytics();
      }
    }, 150);
  });
  
  
  /* =====================================================
     36. INISIALISASI APLIKASI
     ===================================================== */
  
  function initializeAppUI() {
    $("tanggalNota").value = localDate();
  
    renderCustomerOptions();
    renderCustomers();
    renderCategories();
    renderManager();
  
    $("itemRows").innerHTML = "";
    addEmptyRow();
  
    $("historyType").value = "monthly";
    renderHistoryOptions();
    renderHistoryAnalytics();
  }
  
  
  /* =====================================================
     37. PEMERIKSAAN SESI FIREBASE
     ===================================================== */
  
  let authStateInitialized = false;
  
  onAuthStateChanged(auth, async user => {
    currentUser = user;
  
    if (!user) {
      invoices = [];
      customers = [];
      categories = [];
  
      $("appScreen").classList.add("hidden");
      $("authScreen").classList.remove("hidden");
  
      $("profileDropdown").classList.add("hidden");
  
      showLoginForm();
  
      authStateInitialized = true;
      return;
    }
  
    $("authScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");
  
    updateProfileInformation(user);
  
    try {
      await loadSettings();
      await loadAllAccountData();
  
      initializeAppUI();
  
      showToast("Akun berhasil terhubung.");
  
    } catch (error) {
      console.error("Gagal memuat akun:", error);
  
      showToast(
        "Gagal memuat data: " + firebaseErrorMessage(error),
        "error"
      );
    }
  
    authStateInitialized = true;
  });
  
  
/* =====================================================
   NAVIGASI ENTER PADA BARIS BARANG
   ===================================================== */

function enableItemKeyboardNavigation(container) {
    container.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
  
      const target = event.target;
  
      if (!target.classList.contains("item-name")) return;
  
      event.preventDefault();
  
      const row = target.closest("tr");
      const select = row?.querySelector(".category-select");
  
      if (!select) return;
  
      select.focus();
  
      if (typeof select.showPicker === "function") {
        try {
          select.showPicker();
        } catch (error) {
          // Jika browser menolak, fokus tetap pada kategori.
        }
      }
    });
  }
  
  enableItemKeyboardNavigation($("itemRows"));
  enableItemKeyboardNavigation($("editItemRows"));
  
  /* =====================================================
     AKHIR SCRIPT
     ===================================================== */
     
