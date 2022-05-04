(async () => {
    const {importAll, getScript} = await import(`https://rpgen3.github.io/mylib/export/import.mjs`);
    await Promise.all([
        'https://code.jquery.com/jquery-3.3.1.min.js',
        'https://colxi.info/midi-parser-js/src/main.js'
    ].map(getScript));
    const {$, MidiParser} = window;
    const html = $('body').empty().css({
        'text-align': 'center',
        padding: '1em',
        'user-select': 'none'
    });
    const head = $('<header>').appendTo(html),
          main = $('<main>').appendTo(html),
          foot = $('<footer>').appendTo(html);
    $('<h1>').appendTo(head).text('MIDIとモールス信号を相互変換');
    const rpgen3 = await importAll([
        [
            'input',
            'css',
            'util'
        ].map(v => `https://rpgen3.github.io/mylib/export/${v}.mjs`)
    ].flat());
    const rpgen4 = await import('https://rpgen3.github.io/piano/mjs/toMIDI.mjs');
    Promise.all([
        [
            'container',
            'tab',
            'img',
            'btn'
        ].map(v => `https://rpgen3.github.io/spatialFilter/css/${v}.css`)
    ].flat().map(rpgen3.addCSS));
    const addHideArea = (() => {
        const hideTime = 500;
        return (label, parentNode = main) => {
            const html = $('<div>').addClass('container').appendTo(parentNode);
            const input = rpgen3.addInputBool(html, {
                label,
                save: true,
                value: true
            });
            const area = $('<dl>').appendTo(html);
            input.elm.on('change', () => input() ? area.show(hideTime) : area.hide(hideTime)).trigger('change');
            return Object.assign(input, {
                get html(){
                    return area;
                }
            });
        };
    })();
    const morse = new Map;
    morse.set('トン', '・');
    morse.set('ツー', '－');
    {
        const {html} = addHideArea('モールス信号 to MIDI');
        for(const [label, value] of morse) {
            rpgen3.addInputStr(html, {
                label,
                value,
                readonly: true
            });
        }
        const inputMorse = rpgen3.addInputStr(html, {
            label: 'モールス信号',
            textarea: true,
            save: true
        });
        $('<dd>').appendTo(html);
        const outputMIDI = rpgen3.addBtn(html, 'MIDI出力', () => {
            const arr = inputMorse().match(/[・－]+/g).map(v => v.split('').map(v => v === '・' ? 1 : 2));
            if(!arr.length) alert('input morse');
            rpgen3.download(
                rpgen4.toMIDI({
                    tracks: [[0, morse2midi(arr)]]
                }),
                'midi2morse.mid'
            );
        }).addClass('btn');
    }
    let g_midi = null;
    {
        const {html} = addHideArea('MIDI to モールス信号');
        $('<dt>').appendTo(html).text('MIDIファイル');
        const inputFile = $('<input>').appendTo($('<dd>').appendTo(html)).prop({
            type: 'file',
            accept: '.mid'
        });
        MidiParser.parse(inputFile.get(0), v => {
            g_midi = v;
            const {track} = v;
            selectMorseTrack.update([...track.keys()]);
        });
        const selectMorseTrack = rpgen3.addSelect(html, {
            label: 'モールス信号のトラック'
        });
        const inputPitch = rpgen3.addInputStr(html, {
            label: 'モールス信号のピッチ',
            value: 72
        });
        rpgen3.addBtn(html, 'モールス信号出力', () => {
            if(!g_midi) return alert('Error: Must input MIDI file.');
            const n = selectMorseTrack();
            if(!n && n !== 0) return alert('Error: Select morse track.');
            const pitch = Number(inputPitch());
            if(Number.isNaN(pitch)) return alert('Error: Pitch is number.');
            outputMorse(midi2morse(n, pitch));
        }).addClass('btn');
        const outputMorse = rpgen3.addInput(html, {
            label: 'モールス信号',
            textarea: true,
            readonly: true
        });
    }
    const morse2midi = inputArray => {
        const outputArray = [];
        const unitTime = 0x01E0 / 4;
        let currentTime = 0;
        for(const morse of inputArray) {
            for(const n of morse) {
                const len = unitTime * n;
                for(const [i, when] of [
                    currentTime,
                    currentTime + len
                ].entries()) {
                    outputArray.push({
                        pitch: 72,
                        velocity: i === 0 ? 100 : 0,
                        when
                    });
                }
                currentTime += len;
            }
            currentTime += unitTime;
        }
        return outputArray;
    };
    const midi2morse = (morseTrack, morsePitch) => {
        let outputStr = '';
        const {track, timeDivision} = g_midi; // 4分音符の長さ
        const unitTime = timeDivision / 4;
        let currentTime = 0;
        let lastTime = 0;
        for(const {deltaTime, type, data} of track[morseTrack].event) {
            currentTime += deltaTime;
            if(type !== 8 && type !== 9) continue;
            const [pitch, velocity] = data,
                  isNoteOFF = type === 8 || !velocity;
            if(pitch !== morsePitch) continue;
            const len = currentTime - lastTime;
            if(isNoteOFF) {
                outputStr += len <= unitTime ? morse.get('トン') : morse.get('ツー');
            }
            else {
                if(len > unitTime) outputStr += '\n';
                lastTime = currentTime;
            }
        }
        return outputStr;
    };
})();
