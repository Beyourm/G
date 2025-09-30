// Offer.js - الإصدار النهائي (مع ضمان الترميز UTF-8)

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweX983lj4xsTDLo6C64usEcnbFmLST2aQ4v79zjKgIv2v5zGAJERurt_eLXf58dZhtIw/exec'; 
const INSTITUTION_WHATSAPP_NUMBER = '967778185189';

document.addEventListener('DOMContentLoaded', () => {
    // 1. تحديد العناصر (Selectors)
    const form = document.getElementById('registrationForm');
    const coursesListContainer = document.getElementById('coursesList');
    const statusDisplay = document.getElementById('selectionStatus');
    const submissionMessage = document.getElementById('submissionMessage');
    const submitButton = document.getElementById('submitButton');
    const countrySelect = document.getElementById('country');
    const loadingIndicator = document.getElementById('loadingIndicator');
    // 🚨 عنصر التشخيص
    const serverDebugLog = document.getElementById('serverDebugLog'); 

    const MIN_SELECTION = 2; // الحد الأدنى لاختيار الدورات
    let courseCheckboxes; // لتخزين جميع Checkboxes بعد التوليد

    /**
     * دالة مساعدة لتسجيل رسائل التشخيص في عنصر HTML.
     */
    const appendToDebugLog = (message, isError = false) => {
        if (!serverDebugLog) return;
        const timestamp = new Date().toLocaleTimeString('ar-EG', { hour12: false });
        const color = isError ? 'red' : 'green';
        serverDebugLog.innerHTML += `<span style="color: grey;">[${timestamp}]</span> <span style="color: ${color};">${message}</span>\n`;
        serverDebugLog.scrollTop = serverDebugLog.scrollHeight; 
        console.log(`[DEBUG] ${message}`);
    };

    // 2. دوال مساعدة وإدارية
    // ... (buildWhatsappURL و populateCountries تبقى كما هي) ...
    const buildWhatsappURL = (dataObj, coursesString, coursesCount) => {
        let messageBody = `مرحباً مؤسسة كن أنت، أرجو تأكيد اشتراكي في عرض VIP. هذه بيانات التسجيل المرسلة عبر النموذج:`;
        for (const [key, value] of Object.entries(dataObj)) {
            messageBody += `\n* ${key}: ${value}`;
        }
        messageBody += `\n* الدورات المختارة (${coursesCount}): ${coursesString}`;
        const encodedMessage = encodeURIComponent(messageBody);
        return `https://wa.me/${INSTITUTION_WHATSAPP_NUMBER}?text=${encodedMessage}`;
    };

    const populateCountries = () => {
        const arabCountries = ["السعودية", "الإمارات", "الكويت", "قطر", "البحرين", "عمان", "الأردن", "لبنان", "مصر", "المغرب", "تونس", ...];
        if (typeof arabCountries !== 'undefined' && Array.isArray(arabCountries)) {
            arabCountries.forEach(country => {
                const option = document.createElement('option');
                option.value = country;
                option.textContent = country;
                countrySelect.appendChild(option);
            });
        }
    };
    
    /**
     * يجلب قائمة الدورات من Google Sheet ويولد عناصر HTML.
     */
    const generateCoursesList = async () => {
        
        const PUBLISHED_SHEET_ID = '2PACX-1vR0xJG_95MQb1Dwqzg0Ath0_5RIyqdEoHJIW35rBnW8qy17roXq7-xqyCPZmGx2n3e1aj4jY1zkbRa-';
        // سنعود لـ GID الأساسي الذي أرسلته أنت، وهو الأصح للتبويبة الثانية
        const GID = '1511305260'; 
        const COURSES_API_URL = 
            `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_SHEET_ID}/pub?gid=${GID}&single=true&output=csv`;

        coursesListContainer.innerHTML = '<div class="loading-courses">جاري تحميل الدورات... <i class="fa-solid fa-spinner fa-spin"></i></div>';
        submitButton.disabled = true;

        try {
            appendToDebugLog(`1. بدء الجلب من: GID=${GID}`);
            
            const response = await fetch(COURSES_API_URL); 
            
            if (!response.ok) {
                const errorMessage = `فشل الاتصال: حالة السيرفر ${response.status}.`;
                appendToDebugLog(errorMessage, true);
                throw new Error(errorMessage);
            }
            
            // 🚨 التعديل الحاسم هنا: قراءة البيانات كـ Blob ثم قراءتها كـ UTF-8
            const blob = await response.blob();
            const text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsText(blob, 'UTF-8'); // فرض استخدام ترميز UTF-8
            });

            appendToDebugLog(`2. نجاح الجلب وضمان الترميز. تم استلام ${text.length} حرف.`);
            
            // 3. معالجة بيانات CSV - تعديل هنا
            // تنظيف النص من الأحرف غير المرئية أو المشاكل الترميزية
            const cleanText = text.replace(/[^\t\n\r\u2028\u2029\uFEFFء-ي,\r\n\s"']/g, '');
            // تقسيم الأسطر باستخدام تعبير نمطي لجميع الحالات
            const rows = cleanText.trim().split(/\r\n|\n|\r/); 
            appendToDebugLog(`3. تم تقسيم النص بنجاح إلى ${rows.length} صف.`); 

            if (rows.length < 2) {
                const errorMessage = 'خطأ: لم يتم العثور على أسطر بيانات بعد الرؤوس.';
                coursesListContainer.innerHTML = '<p class="error-message status-error">⚠️ لم يتم العثور على بيانات. (تأكد من GID).</p>';
                appendToDebugLog(errorMessage, true);
                 return;
            }

            // الصف الأول هو رؤوس الأعمدة
            const headers = rows[0].split(',').map(header => header.trim().replace(/"/g, ''));
            const requiredColumns = ['id', 'title', 'heroDescription', 'is_vip']; 
            
            // 🚨 نقطة تشخيص حرجة: سنعرض جزء من البيانات للتأكد من أنها لم تُفسَد بالترميز
            const firstRowData = rows[1] ? rows[1].substring(0, 50) : 'لا يوجد صف ثاني';
            appendToDebugLog(`4. عينة من الصف الثاني (50 حرف): ${firstRowData}`);

            const missingColumns = requiredColumns.filter(col => !headers.includes(col));
            if (missingColumns.length > 0) {
                const errorMessage = `خطأ في رؤوس الأعمدة. الأعمدة المفقودة هي: ${missingColumns.join(', ')}.`;
                 coursesListContainer.innerHTML = `<p class="error-message status-error">❌ ${errorMessage}</p>`;
                appendToDebugLog(errorMessage, true);
                 return;
            }
            
            appendToDebugLog("5. جميع الأعمدة المطلوبة موجودة. بدء الفلترة...");

            const coursesMatrix = [];
            let vipCoursesFound = 0;

            for (let i = 1; i < rows.length; i++) {
                const rowValues = rows[i].split(/,(?=(?:(?:[^\"]*\"){2})*[^\"]*$)/); 
                const course = {};
                let is_vip_match = false;
                
                if (rowValues.every(val => !val.trim())) continue; 
                
                for (let j = 0; j < headers.length; j++) {
                    const colName = headers[j];
                    let value = rowValues[j] ? rowValues[j].trim().replace(/^\"|\"$/g, '') : ''; 
                    
                    course[colName] = value;
                    
                    if (colName === 'is_vip' && value.toUpperCase() === 'Y') {
                        is_vip_match = true;
                    }
                }
                
                if (is_vip_match && course.id && course.title) {
                    coursesMatrix.push(course);
                    vipCoursesFound++;
                }
            }
            
            appendToDebugLog(`6. إنهاء الفلترة. دورات VIP المقبولة: ${vipCoursesFound}.`);

            // 6. توليد عناصر الـ Checkboxes
            coursesListContainer.innerHTML = '';
            if (coursesMatrix.length > 0) {
                coursesMatrix.forEach(course => {
                    const label = document.createElement('label');
                    label.classList.add('course-item');
                    label.innerHTML = `\n                        <input type="checkbox" name="courses_selected" value="${course.title}" aria-label="${course.title}">\n                        <span class="custom-checkbox"></span>\n                        <span class="course-title"><i class="fa-solid fa-circle-check"></i> ${course.title}</span>\n                        <span class="course-description">${course.heroDescription || ''}</span>\n                    `;
                    coursesListContainer.appendChild(label);
                });
                
                courseCheckboxes = coursesListContainer.querySelectorAll('input[type="checkbox"]');
                courseCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', handleCourseChange);
                });
                updateSelectionStatus();
                appendToDebugLog("7. تم عرض الدورات بنجاح. انتهى التشخيص.", false);

            } else {
                const errorMessage = 'لم يتم العثور على دورات VIP. (تأكد من وجود قيمة **Y** في عمود is_vip).';
                appendToDebugLog(errorMessage, true);
                coursesListContainer.innerHTML = `<p class="error-message status-error">⚠️ ${errorMessage}</p>`;
            }

        } catch (error) {
            const finalMessage = `❌ فشل فادح في التحليل/الـ DOM. رسالة الخطأ: ${error.message}`;
            appendToDebugLog(finalMessage, true);
            coursesListContainer.innerHTML = `<p class="error-message status-error" style="font-weight: bold; padding: 10px; border: 1px solid red; background: #ffebeb;">فشل التحليل. ر[...]\n
        } finally {
            if (!courseCheckboxes || courseCheckboxes.length === 0) {
                 submitButton.disabled = true;
            }
        }
    };
    
    // ... (بقية دوال النموذج تبقى كما هي) ...

    const displayFieldError = (inputElement, message) => {
        const errorElement = document.getElementById(inputElement.id + 'Error');
        if (!errorElement) return;
        if (message) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            inputElement.classList.add('input-error');
        } else {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
            inputElement.classList.remove('input-error');
        }
    };
    const validateField = (input) => {
        const value = input.value.trim();
        let message = '';
        if (input.hasAttribute('required') && (value === '' || (input.tagName.toLowerCase() === 'select' && input.value === ''))) {
            message = 'هذا الحقل مطلوب ولا يمكن تركه فارغاً.';
        } else {
            switch (input.id) {
                case 'email':
                    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = 'يرجى إدخال بريد إلكتروني صحيح.';
                    break;
                case 'phone':
                    const phoneSanitized = value.replace(/[\s\-\(\)]/g, '');
                    if (phoneSanitized.length > 0 && phoneSanitized.length < 8) message = 'يرجى إدخال رقم هاتف لا يقل عن 8 أرقام.';
                    break;
                case 'age':
                    const age = parseInt(value);
                    if (value && (isNaN(age) || age < 18 || age > 99)) message = 'يجب أن يكون العمر بين 18 و 99.';
                    break;
            }
        }
        displayFieldError(input, message);
        return !message;
    };
    
    const validateForm = () => {
        let isFormValid = true;
        form.querySelectorAll('[required]').forEach(input => {
            if (!validateField(input)) isFormValid = false;
        });
        if (!updateSelectionStatus(false)) isFormValid = false; 
        
        if (isFormValid) {
            submitButton.classList.add('ready-to-submit');
            submitButton.disabled = false;
        } else {
            submitButton.classList.remove('ready-to-submit');
            submitButton.disabled = true;
        }
        
        return isFormValid;
    };
    
    const handleCourseChange = (e) => {
        e.target.closest('.course-item').classList.toggle('is-selected', e.target.checked);
        updateSelectionStatus();
    };
    
    const updateSelectionStatus = (updateValidation = true) => {
        if (!courseCheckboxes) return false;
        const checkedCount = Array.from(courseCheckboxes).filter(cb => cb.checked).length;
        const coursesErrorElement = document.getElementById('coursesError');
        coursesErrorElement.style.display = 'none';

        if (checkedCount < MIN_SELECTION) {
            statusDisplay.classList.add('status-error');
            statusDisplay.classList.remove('status-success');
            let message = (checkedCount === 0) 
                ? 'يجب اختيار دورتين على الأقل. لم يتم اختيار أي دورة حتى الآن.'
                : `يجب اختيار دورتين على الأقل. اختر ${MIN_SELECTION - checkedCount} دورة إضافية.`;
            statusDisplay.textContent = message;
            coursesErrorElement.textContent = (checkedCount === 0) ? 'الرجاء اختيار دورتين على الأقل.' : `تحتاج لاختيار ${MIN_SELECTION - checkedCount} دورة إضافية.`;
            coursesErrorElement.style.display = 'block';
            
            if (updateValidation) validateForm();
            return false;
        } else {
            statusDisplay.classList.remove('status-error');
            statusDisplay.classList.add('status-success');
            statusDisplay.textContent = `اختيار موفق! تم اختيار ${checkedCount} دورة. أكمل بيانات التسجيل وأرسلها.`;
            
            if (updateValidation) validateForm();
            return true;
        }
    };
    
    const handleSubmit = async function(e) {
        e.preventDefault(); 
        if (!validateForm()) return; 

        submitButton.textContent = 'جاري إرسال البيانات...';
        submitButton.disabled = true;
        loadingIndicator.style.display = 'flex';
        submissionMessage.style.display = 'none';

        const formData = new FormData(this);
        const urlParams = new URLSearchParams(formData); 
        const selectedCourseElements = Array.from(courseCheckboxes).filter(cb => cb.checked);
        const coursesString = [];
        
        const allFields = {
            'الاسم الكامل': formData.get('الاسم الكامل'),
            'البريد الإلكتروني': formData.get('البريد الإلكتروني'),
            'رقم الهاتف': formData.get('رقم الهاتف'),
            'العمر': formData.get('العمر'),
            'الجنس': formData.get('الجنس'),
            'البلد': formData.get('البلد'), 
            'ملاحظات إضافية': formData.get('ملاحظات إضافية') || 'لا توجد',
        };
        selectedCourseElements.forEach(checkbox => coursesString.push(checkbox.value));
        const coursesStringJoined = coursesString.join('، '); 

        try {
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: 'POST',
                body: urlParams
            });

            const resultText = await response.text();
            console.log("🔎 رد السيرفر:", resultText);

            let result;
            try {
                if (resultText && resultText.trim().startsWith('{')) {
                    result = JSON.parse(resultText);
                } else {
                    if (response.status >= 200 && response.status < 300) {
                        result = { success: true, message: "تم افتراض النجاح بناءً على Status 200." };
                    } else {
                         throw new Error(`فشل الإرسال: الرد غير صالح وحالة السيرفر هي: ${response.status}`);
                    }
                }
            } catch(e) {
                 throw new Error("فشل تحليل الرد من السيرفر. (الرجاء التحقق من نشر Google Script)");
            }

            if (!result.success) {
                throw new Error(result.message || "خطأ أثناء إرسال البيانات: عملية Script فشلت");
            }
            
            const whatsappURL = buildWhatsappURL(allFields, coursesStringJoined, coursesString.length);

            let countdown = 3;
            const timer = setInterval(() => {
                submissionMessage.textContent = `✅ تم تسجيل بياناتك بنجاح! جارٍ توجيهك خلال ${countdown}...`;
                submissionMessage.classList.add('status-success');
                submissionMessage.classList.remove('status-error');
                submissionMessage.style.display = 'block';
                countdown--;
                if (countdown < 0) {
                    clearInterval(timer);
                    window.location.href = whatsappURL;
                }
            }, 1000);

        } catch (error) {
            submissionMessage.classList.remove('status-success');
            submissionMessage.classList.add('status-error');
            submissionMessage.textContent = '❌ حدث خطأ أثناء إرسال البيانات. الرجاء المحاولة مرة أخرى.';
            submissionMessage.style.display = 'block';
            console.error('خطأ في الإرسال:', error.message);
        } finally {
            submitButton.textContent = 'إرسال التسجيل الآن'; 
            submitButton.disabled = false; 
            submitButton.classList.remove('ready-to-submit'); 
            loadingIndicator.style.display = 'none'; 
        }
    }
    form.addEventListener('submit', handleSubmit);
    
    // 6. تهيئة الصفحة
    form.querySelectorAll('[required]').forEach(input => {
        input.addEventListener('input', validateForm); 
        if (input.tagName.toLowerCase() === 'select') {
            input.addEventListener('change', validateForm); 
        }
    });

    populateCountries();
    generateCoursesList(); 
});