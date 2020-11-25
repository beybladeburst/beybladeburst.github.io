let names;
const groups = ['remake', 'layer6s', 'layer6r', 'layer6c', 'layer5b', 'layer5c', 'layer5w', 'frame', 'dash', 'high', ...[...Array(5).keys()].map(i => ['layer' + (i + 1), 'driver' + (i + 1)]).flat()];
const DB = {
    db: null,
    del() {
        indexedDB.deleteDatabase('db');
        console.log('Deleted')
    },
    init(open) {
        DBview.init();
        ['html', 'json', 'order'].forEach(store => open.result.createObjectStore(store));
        open.transaction.objectStore('json').createIndex('group', 'group');
        return open.transaction;
    },
    open(handler) {
        if (DB.db)
            return handler();
        let firstTime = false;
        const open = indexedDB.open('db', 1);
        open.onupgradeneeded = () => {
            firstTime = true;
            DB.init(open).oncomplete = () => DB.cache(handler);
        }
        open.onsuccess = () => {
            DB.db = open.result;
            return firstTime ? null : handler();
        }
    },
    cache(handler) {
        fetch('/staticVCRV/update/names.json').then(r => r.json()).then(j => DB.put('json', ['names', j]));
        DB.fetch(groups).then(grouped => {
            const tran = DB.db.transaction(['json', 'order', 'html'], 'readwrite');
            grouped.forEach((json, i) => {
                if (!json) return;
                const {info, parts} = json;
                if (info)
                    DB.put('html', [groups[i], info], tran);
                DB.put('order', [groups[i], parts.map(part => part?.sym || part)], tran);
                parts.filter(part => part && typeof part == 'object').forEach(part =>
                    DB.put('json', [`${part.sym}.${part.comp}`, Parts.detach(part)], tran));
                // if (group == 'layer5')
                //     tran.objectStore('html').put(Q('.catalog>a:not([id])').outerHTML, group);
                DBview.update();
                console.log(groups[i] + ' cached');
            });
        }).then(handler);
    },
    fetch(groups) {
        return Promise.all(groups.map(g => fetch(`/staticVCRV/update/${g}.json`).then(r => r.status === 200 ? r.json() : null)));
    },
    put(store, [key, value], tran) {
        (tran || DB.db.transaction(store, 'readwrite')).objectStore(store).put(value, key);
    },
    get(store, key, tran) {
        const handler = () => (tran || DB.db.transaction(store)).objectStore(store).get(key);
        return DB.open(handler);
    },
    getNames(tran) {
        const handler = () => DB.get('json', 'names', tran).onsuccess = ev => names = ev.target.result;
        DB.open(handler);
    },
    getParts(group, callback) {
        const handler = () => {
            const tran = DB.db.transaction(['json', 'order', 'html'], 'readwrite');
            if (!names)
                DB.getNames(tran);
            const parts = {};
            tran.objectStore('json').index('group').openCursor(group).onsuccess = ev => {
                const cursor = ev.target.result;
                if (!cursor)
                    return Promise.all([['order', group], ['html', group]].map(p => DB.get(...p, tran))).then(reqs => callback(reqs, parts));
                const [sym, comp] = cursor.primaryKey.split('.');
                parts[sym] = Parts.attach([sym, comp], cursor.value);
                cursor.continue();
            }
        }
        return DB.open(handler);
    }
}
const DBview = {
    get progress() {
        return document.querySelector('progress');
    },
    init() {
        document.body.insertAdjacentHTML('beforeend', '<progress value=0></progress>');
        DBview.progress.hidden = false;
        DBview.progress.max = groups.length + 1;
    },
    update() {
        DBview.progress.value++;
    }
}
