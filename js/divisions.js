import {
    auth,
    db,
    ref,
    onValue,
    push,
    update,
    onAuthStateChanged
} from '../assets/firebase/secured-firebase.js';

const ALLOWED_UIDS = new Set([
    'W1kKuGtCwWeF9n4Vqv9MAdhbn6g1',
    'tGL8dRTcAIfzUjuWInW6rTAn3Ez1'
]);

const DIVISIONS = [
    { id: 'younger', label: 'Younger', description: 'Ages 4–6' },
    { id: 'primary', label: 'Primary', description: 'Ages 7–9' },
    { id: 'middler', label: 'Middler', description: 'Ages 10–12' }
];

const ui = {
    statusBanner: document.getElementById('admin-status'),
    displayMonth: document.getElementById('display-month'),
    prevMonthBtn: document.getElementById('prev-month-btn'),
    nextMonthBtn: document.getElementById('next-month-btn'),
    monthSelect: document.getElementById('month-select'),
    viewSelect: document.getElementById('attendance-view-select'),
    downloadBtn: document.getElementById('download-attendance-btn'),
    tabsContainer: document.getElementById('division-tabs'),
    divisionTitle: document.getElementById('division-title'),
    divisionDescription: document.getElementById('division-description'),
    addForm: document.getElementById('add-student-form'),
    addInput: document.getElementById('student-input'),
    studentList: document.getElementById('student-list'),
    attendanceTable: document.getElementById('attendance-table')
};

let serverTimeOffsetMs = 0;
let selectedDivision = 'younger';
let monthOffset = 0;
let currentDivisionSnapshot = null;
let currentDivisionUnsubscribe = null;
let currentUser = null;

const getServerNow = () => new Date(Date.now() + serverTimeOffsetMs);

const getViewedMonth = () => {
    const now = getServerNow();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
};

const formatMonthLabel = (date) => date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long'
});

const getSundayDates = (year, month) => {
    const dates = [];
    const date = new Date(year, month, 1);
    const firstDay = date.getDay();
    const firstSunday = new Date(date);
    firstSunday.setDate(date.getDate() + ((7 - firstDay) % 7));
    for (let current = new Date(firstSunday); current.getMonth() === month; current.setDate(current.getDate() + 7)) {
        dates.push(new Date(current));
    }
    if (!dates.length) {
        dates.push(new Date(year, month, 1));
    }
    return dates;
};

const formatDateKey = (date) => date.toISOString().split('T')[0];

const formatStudentName = (raw) => {
    const cleaned = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) {
        return '';
    }

    const parts = cleaned.split(' ');
    if (parts.length === 1) {
        return `${parts[0]}`;
    }

    const lastName = parts.pop();
    const firstName = parts.shift();
    const middleParts = parts;
    let middle = '';

    if (middleParts.length) {
        const initials = middleParts
            .map((part) => part[0]?.toUpperCase() || '')
            .filter(Boolean)
            .map((letter) => `${letter}.`)
            .join(' ');
        middle = initials ? ` ${initials}` : '';
    }

    return `${lastName}, ${firstName}${middle}`;
};

const getDivisionMeta = (divisionId) => DIVISIONS.find((item) => item.id === divisionId) || DIVISIONS[0];

const getMonthOptions = () => {
    const now = getServerNow();
    return Array.from({ length: 4 }, (_, index) => {
        const offset = -index;
        const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        return {
            label: date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' }),
            value: offset
        };
    });
};

const updateMonthSelect = () => {
    if (!ui.monthSelect) return;
    ui.monthSelect.innerHTML = getMonthOptions()
        .map((item) => `<option value="${item.value}">${item.label}</option>`)
        .join('');
    ui.monthSelect.value = String(monthOffset);
};

const renderAttendanceTable = () => {
    const division = currentDivisionSnapshot || {};
    const students = division.students || {};
    const sundayDates = getSundayDates(getViewedMonth().getFullYear(), getViewedMonth().getMonth());
    const isSummary = ui.viewSelect?.value === 'summary';

    const headerColumns = sundayDates.map((date) => `
        <th>${date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</th>
    `).join('');

    const rows = Object.entries(students)
        .sort(([, a], [, b]) => a.name.localeCompare(b.name))
        .map(([studentId, student]) => {
            const attendance = student.attendance || {};
            const rowCells = sundayDates.map((date) => {
                const dateKey = formatDateKey(date);
                const checked = attendance[dateKey] === true;

                if (isSummary) {
                    return `
                        <td class="attendance-cell summary-cell">
                            <span class="summary-mark ${checked ? 'checked' : ''}">${checked ? '✓' : ''}</span>
                        </td>
                    `;
                }

                return `
                    <td class="attendance-cell">
                        <label class="checkbox-label">
                            <input
                                type="checkbox"
                                data-student-id="${studentId}"
                                data-date="${dateKey}"
                                ${checked ? 'checked' : ''}
                                ${!isAdmin() ? 'disabled' : ''}
                            >
                            <span class="checkbox-custom"></span>
                        </label>
                    </td>
                `;
            }).join('');

            return `
                <tr>
                    <td>${student.name}</td>
                    ${rowCells}
                </tr>
            `;
        });

    ui.attendanceTable.innerHTML = `
        <thead>
            <tr>
                <th class="student-column">Student name</th>
                ${headerColumns}
            </tr>
        </thead>
        <tbody>
            ${rows.length ? rows.join('') : `<tr><td colspan="${sundayDates.length + 1}" class="empty-state">No attendance records found for this division.</td></tr>`}
        </tbody>
    `;

    if (!isSummary) {
        ui.attendanceTable.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
            checkbox.addEventListener('change', async (event) => {
                if (!isAdmin()) {
                    event.preventDefault();
                    return;
                }
                const studentId = event.target.dataset.studentId;
                const dateKey = event.target.dataset.date;
                const checked = event.target.checked;
                await updateAttendanceRecord(studentId, dateKey, checked);
            });
        });
    }
};

const getAttendanceMatrix = () => {
    const division = currentDivisionSnapshot || {};
    const students = division.students || {};
    const allDates = new Set();

    Object.values(students).forEach((student) => {
        Object.keys(student.attendance || {}).forEach((date) => allDates.add(date));
    });

    return {
        students: Object.entries(students).sort(([, a], [, b]) => a.name.localeCompare(b.name)),
        dates: Array.from(allDates).sort()
    };
};

const downloadAttendanceCsv = () => {
    const division = currentDivisionSnapshot || {};
    const students = division.students || {};
    const { dates } = getAttendanceMatrix();
    const headers = ['Student name', ...dates];

    const escapedCell = (value) => `"${String(value || '').replace(/"/g, '""')}"`;
    const rows = Object.values(students)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((student) => [
            student.name,
            ...dates.map((date) => (student.attendance?.[date] ? 'Present' : ''))
        ]);

    const csv = [headers, ...rows]
        .map((row) => row.map(escapedCell).join(','))
        .join('\r\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedDivision}-attendance.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};

const isAdmin = () => ALLOWED_UIDS.has(currentUser?.uid);

const renderDivisionTabs = () => {
    ui.tabsContainer.innerHTML = DIVISIONS.map((division) => `
        <button type="button" class="division-tab${division.id === selectedDivision ? ' active' : ''}" data-division="${division.id}">
            ${division.label}
        </button>
    `).join('');

    ui.tabsContainer.querySelectorAll('.division-tab').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.division === selectedDivision) {
                return;
            }
            selectedDivision = button.dataset.division;
            loadDivisionAttendance();
        });
    });
};

const renderStatusBanner = () => {
    const viewedMonth = getViewedMonth();
    const monthLabel = formatMonthLabel(viewedMonth);
    const divisionMeta = getDivisionMeta(selectedDivision);
    const nextAllowed = monthOffset < 0;

    ui.displayMonth.textContent = `${divisionMeta.label} — ${monthLabel}`;
    ui.prevMonthBtn.disabled = false;
    ui.nextMonthBtn.disabled = !nextAllowed;

    if (!currentUser) {
        ui.statusBanner.textContent = '';
        ui.statusBanner.className = 'status-banner warning';
    } else if (!isAdmin()) {
        ui.statusBanner.textContent = '';
        ui.statusBanner.className = 'status-banner warning';
    } else {
        ui.statusBanner.textContent = '';
        ui.statusBanner.className = 'status-banner';
    }

    ui.addForm.classList.toggle('hidden', !isAdmin());
};

const renderStudentList = () => {
    const division = currentDivisionSnapshot || {};
    const students = division.students || {};
    const entries = Object.entries(students).sort(([, a], [, b]) => a.name.localeCompare(b.name));
    const canRemove = isAdmin();

    if (!entries.length) {
        ui.studentList.innerHTML = '<li class="empty-state">No students yet. Add names to start tracking attendance.</li>';
        return;
    }

    ui.studentList.innerHTML = entries.map(([key, student]) => `
        <li>
            <div class="student-list-meta">
                <strong>${student.name}</strong>
                ${student.attendance ? ` · ${Object.values(student.attendance).filter(Boolean).length} present` : ''}
            </div>
            ${canRemove ? `<button type="button" class="remove-student-btn" data-student-id="${key}" aria-label="Remove ${student.name}">×</button>` : ''}
        </li>
    `).join('');
};

const removeStudent = async (studentId) => {
    if (!isAdmin()) {
        alert('Only approved admins can remove students.');
        return;
    }

    const studentName = currentDivisionSnapshot?.students?.[studentId]?.name || 'this student';
    const confirmed = confirm(`Remove ${studentName} and all associated attendance records?`);
    if (!confirmed) return;

    const studentsRef = ref(db, `attendance/${selectedDivision}/students`);
    await update(studentsRef, { [studentId]: null });
};

const loadDivisionAttendance = () => {
    renderDivisionTabs();
    renderStatusBanner();

    currentDivisionUnsubscribe?.();
    const divisionRef = ref(db, `attendance/${selectedDivision}`);
    currentDivisionUnsubscribe = onValue(divisionRef, (snapshot) => {
        currentDivisionSnapshot = snapshot.val() || {};
        const divisionMeta = getDivisionMeta(selectedDivision);
        ui.divisionTitle.textContent = divisionMeta.label;
        ui.divisionDescription.textContent = divisionMeta.description;
        renderStudentList();
        renderAttendanceTable();
    });
};

const updateAttendanceRecord = async (studentId, dateKey, checked) => {
    const attendanceUpdateRef = ref(db, `attendance/${selectedDivision}/students/${studentId}/attendance`);
    await update(attendanceUpdateRef, { [dateKey]: checked });
};

const addStudents = async (rawValue) => {
    const entries = String(rawValue || '')
        .split('/')
        .map((item) => formatStudentName(item))
        .filter(Boolean);

    if (!entries.length) {
        alert('Enter at least one student name using the example format.');
        return;
    }

    const existingNames = new Set(Object.values((currentDivisionSnapshot || {}).students || {}).map((student) => student.name));
    const studentsRef = ref(db, `attendance/${selectedDivision}/students`);
    const now = getServerNow().toISOString();

    const additions = entries
        .filter((name) => !existingNames.has(name))
        .map((name) => push(studentsRef, { name, createdAt: now, attendance: {} }));

    if (!additions.length) {
        alert('All students already exist in this division.');
        return;
    }

    await Promise.all(additions);
    ui.addInput.value = '';
};

const changeMonth = (direction) => {
    if (direction === -1) {
        monthOffset -= 1;
    } else if (direction === 1 && monthOffset < 0) {
        monthOffset += 1;
    }
    updateMonthSelect();
    renderStatusBanner();
    renderAttendanceTable();
};

const initialize = () => {
    ui.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
    ui.nextMonthBtn.addEventListener('click', () => changeMonth(1));

    ui.viewSelect.addEventListener('change', () => renderAttendanceTable());
    ui.monthSelect.addEventListener('change', (event) => {
        monthOffset = Number(event.target.value);
        renderStatusBanner();
        renderAttendanceTable();
    });
    ui.downloadBtn.addEventListener('click', downloadAttendanceCsv);

    ui.addForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!isAdmin()) {
            alert('Only approved admins can add students.');
            return;
        }
        await addStudents(ui.addInput.value);
    });

    ui.studentList.addEventListener('click', async (event) => {
        const button = event.target.closest('.remove-student-btn');
        if (!button) return;
        const studentId = button.dataset.studentId;
        if (!studentId) return;
        await removeStudent(studentId);
    });

    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        renderStatusBanner();
        renderAttendanceTable();
        loadDivisionAttendance();
    });

    const serverOffsetRef = ref(db, '.info/serverTimeOffset');
    onValue(serverOffsetRef, (snapshot) => {
        serverTimeOffsetMs = snapshot.val() || 0;
        renderStatusBanner();
        renderAttendanceTable();
    });

    updateMonthSelect();
    renderDivisionTabs();
    loadDivisionAttendance();
};

initialize();
