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
    const rpgen4 = await importAll([
        'https://rpgen3.github.io/maze/mjs/heap/Heap.mjs',
        [
            [
                'fixTrack',
                'toMIDI'
            ].map(v => `midi/${v}`)
        ].flat().map(v => `https://rpgen3.github.io/piano/mjs/${v}.mjs`)
    ].flat());
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
            selectMorseTrack.update([]);
        });
        const selectMorseTrack = rpgen3.addSelect(html, {
            label: 'モールス信号のトラック'
        });
        rpgen3.addBtn(html, 'モールス信号出力', () => {
            const v = selectMorseTrack();
            if(!g_midi) return alert('Error: Must input MIDI file.');
            outputMorse(midi2morse());
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
    const midi2morse = () => {
        const {timeDivision} = g_midi; // 4分音符の長さ
        const bpm = getBPM(g_midi);
    };
    const getBPM = midi => {
        const {track} = midi;
        let bpm = 0;
        for(const {event} of track) {
            for(const v of event) {
                if(v.type !== 0xFF || v.metaType !== 0x51) continue;
                bpm = 6E7 / v.data;
                break;
            }
            if(bpm) break;
        }
        if(bpm) return bpm;
        else throw 'BPM is none.';
    };
    const parseMidi = midi => {
        const {track} = midi,
              heap = new rpgen4.Heap();
        for(const {event} of track) {
            const now = new Map;
            let currentTime = 0;
            for(const {deltaTime, type, data, channel} of event) {
                currentTime += deltaTime;
                if(type !== 8 && type !== 9) continue;
                const [pitch, velocity] = data,
                      isNoteOFF = type === 8 || !velocity;
                if(now.has(pitch) && isNoteOFF) {
                    const unit = now.get(pitch);
                    unit.end = currentTime;
                    heap.add(unit.start, unit);
                    now.delete(pitch);
                }
                else if(!isNoteOFF) now.set(pitch, new MidiUnit({
                    ch: channel,
                    pitch,
                    velocity,
                    start: currentTime
                }));
            }
        }
        return heap;
    };
    class MidiUnit {
        constructor({ch, pitch, velocity, start}){
            this.ch = ch;
            this.pitch = pitch;
            this.velocity = velocity;
            this.start = start;
            this.end = -1;
        }
    }
})();
