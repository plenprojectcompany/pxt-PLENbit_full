let sendId = -1

function GetData () { // シリアル通信からデータを取得する
    let result:string
    sendId+=1

    while(true){
        let data = SerialRead()
        if (data) {
            let dataArry = data.split('|')
            if (dataArry.length == 2) {
                if (sendId == parseInt(dataArry[0])){
                    led.toggle(0, 0)
                    result = dataArry[1]
                    serial.writeLine('S')
                    break
                }
            }
        }

        let checksum = 0
        let sendIDstr = sendId.toString()
        for (let i of sendIDstr) checksum += parseInt(i)
        
        serial.writeLine('Fail[' + sendIDstr + ']' + checksum)
    }

    return result
}

function SerialRead(){　
    let getData = SerialReadUntil('\n')

    // [データ]チェックサム
    if (getData[0] != '[') return false
    getData = getData.slice(1)
    let getDataArray = getData.split(']')
    if (getDataArray.length != 2) return false

    // checksum
    let buffer = Buffer.fromUTF8(getDataArray[0])
    let checksum = 0
    for (let i = 0; i < buffer.length; i++) checksum += buffer[i]
    if (parseInt(getDataArray[1]) != checksum) return false

    return getDataArray[0]
}

function SerialReadUntil(limit:string,timeout=100){
    let data = ''
    let lastReadTime = input.runningTime()
    while(true){
        Loading()
        data += serial.readString()
        let dataArray = data.split(limit)

        if (dataArray.length > 1){
            return dataArray[0]
        }

        if (lastReadTime - input.runningTime() > timeout) return '' // タイムアウト
    }
}

let lastUpdate = 0
let loadFlag = 0

function Loading () {
    let nowTime = input.runningTime()
    if (nowTime - lastUpdate < 250) {
        return -1
    }
    lastUpdate = nowTime
    if (loadFlag % 4 == 0) {
        basic.showLeds(`
            . . . . .
            . . . . .
            . . . . .
            . . . . .
            . . . . .
            `,0)
    } else if (loadFlag % 4 == 1) {
        basic.showLeds(`
            . . . . .
            . . . . .
            # . . . .
            . . . . .
            . . . . .
            `, 0)
    } else if (loadFlag % 4 == 2) {
        basic.showLeds(`
            . . . . .
            . . . . .
            # . # . .
            . . . . .
            . . . . .
            `, 0)
    } else {
        basic.showLeds(`
            . . . . .
            . . . . .
            # . # . #
            . . . . .
            . . . . .
            `, 0)
    }
    loadFlag += 1
    return 0
}

function EEPWrite(address:number,rom2=true){
    let dataArray = []
    while(true){
        let data = GetData()
        if (data == 'Complete') break
        dataArray.push(parseInt(data))
        let len = dataArray.length
        if(len >= 256){
            plenxxx.WriteEEPROM(address, dataArray, rom2)
            dataArray.splice(0, dataArray.length)
            address += len
        }
    }
    plenxxx.WriteEEPROM(address, dataArray, true)
}


let errorCheck = 0

while (true) {
    let data = GetData()

    if(data=='Start'){
        errorCheck ++
        basic.showIcon(IconNames.Diamond)
    }else if(data == 'VerWrite'){
        errorCheck++
        // バージョン情報書き込み
        basic.showString("V")
        EEPWrite(0)
    } else if (data == 'FlameWrite') {
        errorCheck++
        // フレーム情報書き込み
        basic.showString("F")
        EEPWrite(256)
    } else if (data == 'MotionWrite') {
        errorCheck++
        // モーション書き込み
        basic.showString("M")
        EEPWrite(512)
    }else if(data == 'AllComplete'){
        if(errorCheck == 4){
            basic.showIcon(IconNames.Yes)
        }else{
            basic.showIcon(IconNames.No)
        }
        break
    }
}
