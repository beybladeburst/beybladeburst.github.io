class Part {
    constructor(info, derived) {
        Object.assign(this, typeof info == 'object' ? info : {comp: info});
        derived ? this.group = derived : null;
    }
    detach() {
        return (({sym, comp, ...other}) => {
            other.attr = other.attr.filter(attr => !Part.derived.includes(attr));
            for (const p of ['stat', 'desc', 'attr'].filter(p => !`${other[p]}`.replace(/,/g, ''))) 
                delete other[p];
            return ({...other, key: `${sym}.${comp}`, names: this.names?.can ? {can: this.names.can} : {}})
        })(this);
    }
    attach(sym) {
        [this.sym, this.comp] = this.key.split('.');
        if (sym) this.sym = sym;
        [this.names.eng, this.names.chi, this.names.jap] = names[this.comp]?.[this.sym] || names[this.comp]?.[this.sym.replace('′', '')] || ['', '', ''];
        delete this.key;
        return this;
    }
    async revise() {
        if (this.comp != 'driver') 
            return this;
        if (!Part.derived.includes(this.group) || this.group == 'dash')
            for (const g of Part.derived.filter(p => p != this.group)) 
                await Part.list(g);

        if (!Part.derived.includes(this.group)) 
            this.attr = [...this.attr || [], ...Part.derived.filter(g => Part[g].includes(this.sym))];
        else {
            [this.sym, this.desc, this.attr] = {
                high: [`H${this.sym}`, `高度提升的【${this.sym}】driver。`, /′$/.test(this.sym) ? ['dash'] : [] ],
                dash: [`${this.sym}′`, `內藏強化彈簧的【${this.sym}】driver。`, ['high', 'metal'].filter(g => Part[g]?.includes(`${this.sym}′`)) ],
                metal: [`M${this.sym.replace('′', '')}`, `上部 Ring 部分使用金屬的【${this.sym}】driver。`, []]
            }[this.group];
            this.names = Part.derivedNames(this.names, this.group);
            delete this.stat;
        }
        return this;
    }
    static derivedNames(names, group) {
        names = {...(names || {}), can: ''};
        if (group == 'high' || group == 'H')
            [names.eng, names.jap, names.chi] = ['High ' + names.eng, 'ハイ' + names.jap, '高位' + names.chi];
        else if (group == 'metal' || group == 'M')
            [names.eng, names.jap, names.chi] = ['Metal ' + names.eng, 'メタル' + names.jap, '金屬' + names.chi];
        return names;
    }
    static async list(group) {
        return Part[group] || (Part[group] = await DB.get('order', group));
    }
}
Part.derived = ['dash', 'high', 'metal'];

Part.prototype.catalog = function() {
    let {comp, group, sym, type, generation, attr, deck, names, stat, desc} = this;
    const bg = {
        hue: {
            layer: /^\+/.test(sym) ? 80 : !deck ? 140 : 185,
            disk: 230,
            frame: 230,
            driver: deck ? 275 : !/^\+/.test(sym) ? 320 : 5
        }[comp.match(/layer|disk|driver|frame/)[0]],
        set heaviness(classes) {
            bg.heavy = ['fusion', 'light', 'grams'].find(c => classes.includes(c)) || (classes.length > 0 ? '' : null);
        },
        get url() {
            const query = ['hue', 'heavy'].filter(p => bg[p] !== null).map(p => `${p}=${bg[p]}`).join('&');
            const mode = Q('html').classList.contains('day') ? 'day' : 'night';
            return `/parts/include/bg.svg?${mode}&${query}` + (type ? `#${type}${stat?.length || 5}` : ``);
        },
    }
    const weight = {
        levels: w => typeof w == 'string' ?
            ({driver: [14, 10], layer5b: [99, 23, 21], layer5c: [99, 14]}[comp] || []) :
            (/^(layer[45])$/.test(group) || group == 'LB' && comp == 'layer6r' || deck && comp == 'driver' ?
                [8, 0, 0] : deck ? [10, 5, 3] : [18, 10, 8]),
        bucketing: w => weight.classes = [
            deck || /^[IM]$/.test(sym) && comp == 'layer5b' ? 'fusion' : '',
            typeof w == 'string' ? 'grams' : '',
            sym == '幻' || sym == 'L' && comp == 'layer5b' ? 'light' : ['heavy-x', 'heavy-s', 'heavy'][weight.levels(w).findIndex(l => parseInt(w) >= l)]
        ].filter(c => c),
    }
    const code = {
        get symbol() {
            let code = sym
                .replace(/^([dlr]α).$/, '$1')
                .replace(/^([DG][A-Z]|∞)([A-Z].?)$/, '$1<sup>$2</sup>')
                .replace(/^(.{2,}?)([2+])$/, '$1<sup>$2</sup>')
                .replace(/^\+(?=s[wh]|BA)/, '');
            if (sym == 'sΩ')
                code = "Ω";
            else if (comp == 'layer5c' && sym == 'Δ')
                code = "D";
            else if (comp == 'layer6r' && sym[0] != '+')
                code = code[0];
            const cl = code.match(/^[^′<]+/)[0].length == 1 ? sym.charCodeAt(0) > 18000 ? 'kanji' : 'single' : '';
            return `<div class='symbol'><h2${cl ? ` class='${cl}'` : ``}>${code}</h2></div>`;
        },
        get name() {
            if (!names) return '';
            names = {
                eng: comp == 'layer6s' ? `${sym[0]}-${Parts.types[sym[1]]}` : names.eng || '',
                jap: !names.jap && names.can ? sym : names.jap || '',
                chi: (names.chi || '').replace(/[｜︱].*/, ''),
                can: names.can || ''
            }
            if (/′$/.test(sym))
                [names.eng, names.jap] = [names.eng + ' <sup>dash</sup>', names.jap + 'ダッシュ'];

            let len, code, rows = comp == 'layer' || Part.derived.includes(group) || /(メタル|プラス)/.test(names.jap) || names.jap.length >= 10;
            if (rows) {
                len = (names.jap + names.chi).replace(/\s/g, '').length - 15;
                code = `
                <div>
                    <h4 lang=yue>${names.can}</h4>
                    <h3 lang=en>${names.eng}</h3>
                </div>
                <div${len > 0 ? ` style='--space:${len * .045}'` : ''}>
                    <h3 lang=ja>${names.jap}</h3>
                    <h3 lang=zh>${names.chi}</h3>
                </div>`;
            } else {
                len = names.jap.length + (names.chi ? names.chi.length + 2 : 0) + names.eng.length / 2 - (names.eng.match(/[IJfijlt]/g) || []).length / 4 - 13.25;
                code = `
                <div${len > 0 ? ` style='--space:${Math.min(len, 2)}'` : ''}>
                    <h4 lang=yue>${names.can}</h4>
                    <h3 lang=ja>${names.jap}</h3>
                </div>
                <div${len > 0 ? ` style='--space:${Math.min(len, 2)}'` : ''}>
                    <h3 lang=en>${names.eng}</h3>
                    <h3 lang=zh>${names.chi}</h3>
                </div>`;
            }
            return `<div class='name${!Part.derived.includes(group) ? rows ? '-row' : '-col' : ''}'>${code}</div>`;
        },
        get content() {
            const code = `<figure class='${(attr || []).join(' ')}' style='background:url(/parts/${comp}/${sym.replace(/^\+/, '⨁')}.png)'></figure>`;
            if (!stat || Part.derived.includes(group)) return code;
            const terms = ['攻擊力', '防禦力', '持久力', typeof stat[3] == 'string' && stat.length == 5 ? '重量' : '重　量', '機動力', '擊爆力'];
            if (typeof stat[3] == 'string')
                stat[3] = stat[3].replace(/克$/, '<small>克</small>');
            return code + `
            <dl class='stat-${stat.length} ${weight.classes.join(' ')}'>` +
                stat.map((s, i) => s === null ? '' : `<div><dt>${terms[i]}<dd>${s}</div>`).join('') + `
            </dl>`;
        }
    }
    const anchor = attr => {
        const part = document.createElement('a');
        part.innerHTML = `
            <object data='${bg.url}'></object>` + (group ? `
            <div class='info'>` + code.symbol + code.name + `</div>
            <div class='content'>` + code.content + `</div>
            <p class='desc'>` + (desc || '') + `</p>` : ``);
        for (const [a, v] of Object.entries(attr)) if (v) part[a] = v;
        return part;
    }

    if (sym == null)
        return Q('.catalog').appendChild(anchor({classList: 'none'}));

    deck ? Parts.fusion = deck : null;
    bg.heaviness = weight.bucketing(stat?.[3]);

    return Q('.catalog').appendChild(anchor({
        id: comp == 'driver' ? sym.replace('′', '') : sym,
        href: /(9|pP|[lrd]αe|BA)/.test(sym) ? '' : `/products/?${/^\+/.test(sym) ? 'more' : comp}=${encodeURIComponent(sym)}`,
        classList: [...new Set([comp, group, type, generation, sym == 9 ? 'none' : ''])].filter(c => c).join(' ')
    }));
}
Part.prototype.links = function() {
    Q('.catalog>a:last-of-type').removeAttribute('href');
    if (this.group == 'other') return;
    const temp = Q('template').content.cloneNode(true);
    temp.querySelector('a[onclick]').onclick = () => Search.autofill(/^\+/.test(this.sym) ? 'more' : this.comp, this.sym);
    temp.querySelector('a[href]').href = `/parts/?${this.group}#${this.sym}`;
    /^(layer|remake)/.test(this.group) ?
        temp.querySelector('img').src = `/img/system-${this.group.replace(/^layer5$/, 'layer5m').replace(/(layer\d)[^m]$/, '$1')}.png` :
        temp.querySelector('img').remove();
    Q('.catalog').insertBefore(temp, Q('.catalog>a:last-of-type'));
}