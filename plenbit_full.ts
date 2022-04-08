//plenbit_full.ts

/**
 * Blocks for PLEN:bit full
 */
//% weight=999 color=#00A654 icon="\uf0a0" block="PLEN:bit full"
//% groups=['Motion','LED', 'Move', 'Left Servo Positions', 'Right Servo Positions', 'Servo', 'Original Motion','Power', 'Motion Data', 'Servo Adjust']
namespace plenbit_full {

    //グローバル変数==================================================================
    const servoReverse = [true, true, false, true, false, true, true, false, false, false, false, true, false, true, false, false, true, true] //サーボ反転
    const servoCount = servoReverse.length
    export let servoInitArray: number[] = []
    for (let i = 0; i < servoCount; i++) servoInitArray.push(0)
    export let servoAngle: number[] = []
    for (let i = 0; i < servoCount; i++) servoAngle.push(0)
    export let servoAngleGoal: number[] = []
    for (let i = 0; i < servoCount; i++) servoAngleGoal.push(0)
    const PCA9865Adr = 106
    const eepromAdr1 = 0x54
    const eepromAdr2 = 0x55
    let servoInitAdr = 0 //初期位置調整アドレス
    let initEEPROMFlag = false
    let initPCA9865Flag = false
    let backgroundProcessFlag = false
    let autoPoweroffFlag = true
    let startUpTime = -1 // 起動時間
    let autoPoweroffTime = 1800000 //msec オートパワーオフするまでの時間
    let hardwareVersion = parseInt(control.hardwareVersion())
    let continueMotionNumber = [0, 10, 11, 14, 15, 16, 17, 20, 21] // 連続再生用
    let continueMotionTime = 0
    let continueMotionAngles: number[] = []
    for (let i = 0; i < servoCount; i++) continueMotionAngles.push(0)
    let movingFlag = false // サーボ角度変更中？
    let playingMotionNumber = -1 // 再生中のモーション番号
    let motionSpeed = 100
    let recordingFlag = -1

    //初期動作==================================================================
    //PLEN起動
    Power(true)

    //関数==================================================================
    function BackgroundProcess() { // バックグラウンド処理
        if (backgroundProcessFlag) return 0
        backgroundProcessFlag = true

        control.inBackground(function () {
            let playingMotionNumberCheck = -1
            while (true) {
                basic.pause(20) // 20ミリ秒おきに確認
                if (movingFlag) continue

                if (autoPoweroffTime > 0) {
                    let nowTime = input.runningTime()
                    if (autoPoweroffTime != -1) {
                        if (nowTime - startUpTime > autoPoweroffTime) {
                            basic.showString("AUTO POWER OFF", 75)
                            plenbit_full.Power(false) // オートパワーオフ
                            break
                        }
                    }
                }

                if (playingMotionNumber != playingMotionNumberCheck) {
                    playingMotionNumberCheck = playingMotionNumber
                    if (playingMotionNumber != -1) {
                        playingMotionNumber = -1
                        playingMotionNumberCheck = -1
                        LinearServoMoving(continueMotionTime)
                        pause(100)
                        ServoFree(-1)
                    }
                }
            }
        })

        backgroundProcessFlag = false
        return 1
    }

    function PLENStartInit() { // 各種初期化（電源オン時の初期動作）
        basic.showIcon(IconNames.Happy, 0)

        // オートパワーオフ
        startUpTime = input.runningTime()
        BackgroundProcess()

        //サーボ初期位置
        LinearServoMoving(500)
        pause(100)
        ServoFree(-1)

        LedEye(100)
        basic.clearScreen()
    }

    function PLENEndInit() { // 各種初期化（電源オフ時の初期化）
        LedEye(0)
        initPCA9865Flag = false
        startUpTime = -1

        basic.showIcon(IconNames.Asleep, 0)
    }

    export function InitPCA9865() { // PCA9685の初期設定
        if (!initPCA9865Flag) {
            if (ReadPCA9865(0xFE) != 0x00) { // PRE_SCALEが読み取れる <=> PCA9865が接続済み
                initPCA9865Flag = true
                WritePCA9865(0x00, 0x10) // Sleep modeをONにして、内部クロックを停止
                WritePCA9865(0xFE, 0x85) // PRE_SCALEを設定　※ cf.P13 Writes to PRE_SCALE register are blocked when SLEEP xxx is logic 0 (MODE 1)
                WritePCA9865(0x00, 0x00) // Sleep modeをOFFにして、内部クロックをPRE_SCALEで動かす

                pins.analogSetPeriod(AnalogPin.P2, 20000)
                pins.analogSetPeriod(AnalogPin.P8, 20000)
                ServoFree(-1)
            }
        }
    }

    function ReadPCA9865(addr: number) { // PCA9685を読む
        pins.i2cWriteNumber(PCA9865Adr, addr, NumberFormat.UInt8LE, false)
        return pins.i2cReadNumber(PCA9865Adr, NumberFormat.UInt8LE, false)
    }

    function WritePCA9865(addr: number, d: number) { // PCA9685に書く
        let cmd = pins.createBuffer(2)
        cmd[0] = addr
        cmd[1] = d
        pins.i2cWriteBuffer(PCA9865Adr, cmd, false)
    }

    export function ReadEEPROM(eepAdr: number, size: number, rom2 = false) {
        let eepAddress = eepromAdr1
        if (rom2) eepAddress = eepromAdr2
        let data = pins.createBuffer(2)
        data[0] = eepAdr >> 8
        data[1] = eepAdr & 0xFF
        // need adr change code
        pins.i2cWriteBuffer(eepAddress, data)
        return pins.i2cReadBuffer(eepAddress, size, false)
    }

    export function WriteEEPROM(eepAdr: number, value: number[], rom2 = false) {
        let eepAddress = eepromAdr1
        if (rom2) eepAddress = eepromAdr2

        let loopFlag = true

        while (loopFlag) {
            let maxWriteLen = 256 - eepAdr % 256 // 1page(256Byte)づつ書き込める

            let dataLen = 0
            let check = value.length

            if (check > maxWriteLen) {
                dataLen = maxWriteLen
            } else {
                dataLen = check
                loopFlag = false
            }

            let data = pins.createBuffer(2 + dataLen)
            data[0] = eepAdr >> 8
            data[1] = eepAdr & 0xFF
            for (let i = 0; i < dataLen; i++) {
                data[2 + i] = value[i] & 0xFF
            }
            pins.i2cWriteBuffer(eepAddress, data)
            basic.pause(5)
            eepAdr += dataLen
            value.splice(0, dataLen)
        }
    }

    export function ServoControl(num: number, degrees: number, free = false) { // サーボ角を最短で変更する
        InitEEPROM()
        InitPCA9865()

        degrees = Math.round(degrees)

        let msec = 0
        let pwm = 0

        if (free == false) { // サーボフリーの場合、PWMは0
            servoAngle[num] = degrees

            degrees += servoInitArray[num]
            if (servoReverse[num]) {
                degrees *= -1
            }

            msec = 2000 / 180 * (degrees + 90) + 500
            pwm = Math.round(msec / 20000 * 4096)
            if (pwm < 102) pwm = 102
            if (pwm >= 512) pwm = 511
        }

        if (num >= 0 && num <= 17) {
            if (num == 8) {
                pins.servoSetPulse(AnalogPin.P8, msec)
            } else if (num == 17) {
                pins.servoSetPulse(AnalogPin.P2, msec)
            } else {
                let servoNum = 0
                let highByte = false
                if (num < 8) {
                    servoNum = num
                } else if (num < 17) {
                    servoNum = 24 - num
                }
                let servoAddr = 0x08 + servoNum * 4
                if (pwm > 0xFF) {
                    highByte = true
                }
                WritePCA9865(servoAddr, pwm)
                if (highByte) {
                    WritePCA9865(servoAddr + 1, 0x01)
                } else {
                    WritePCA9865(servoAddr + 1, 0x00)
                }
            }
        }
    }

    function LinearServoMoving(msec: number) { // サーボモーターを指定角度servoAngleGoal[]まで線形的に変更
        movingFlag = true
        if (msec < 20) msec = 20
        const startTime = input.runningTime()

        if (recordingFlag >= 0) {
            let motionAdr = (56 + recordingFlag * 2) * 256
            let recordingFlame = ReadEEPROM(motionAdr, 1)[0]
            if (recordingFlame < 23) {
                let percent = (1 - recordingFlame / 23) * 4
                for (let x = 0; x < 5; x++) {
                    for (let y = 4; y >= percent; y--) {
                        led.plot(x, y)
                    }
                }
                WriteEEPROM(motionAdr, [recordingFlame + 1])
                WriteEEPROM(motionAdr + 1 + recordingFlame * 22, [recordingFlag, recordingFlame, (msec >> 8) & 0xFF, msec & 0xFF].concat(servoAngleGoal))
            } else {
                basic.showIcon(IconNames.No, 0)
            }
        }

        let startAngle: number[] = []
        let step: number[] = []
        for (let i = 0; i < servoCount; i++) {
            if (isNaN(servoAngle[i])) servoAngle[i] = 0
            const angle = servoAngle[i]
            startAngle.push(angle)
            step.push((servoAngleGoal[i] - angle) / msec)
        }

        let loop = true

        while (loop) {
            const deltaTime = input.runningTime() - startTime

            for (let i = 0; i < servoCount; i++) {
                ServoControl(i, startAngle[i] + step[i] * deltaTime)
                if (deltaTime >= msec) {
                    loop = false
                    break
                }
            }
        }
        movingFlag = false
    }

    function DoMotion(motionNumber: number, defaultMotion = true) {
        if (defaultMotion) {
            if (motionNumber < 0) return -1
            if (motionNumber >= 256) return -1
        } else {
            if (motionNumber < 0) return -1
            if (motionNumber >= 100) return -1
        }

        if (playingMotionNumber != -1 && (playingMotionNumber != motionNumber || !defaultMotion)) {
            for (let i = 0; i < servoCount; i++) servoAngleGoal[i] = continueMotionAngles[i]
            LinearServoMoving(continueMotionTime)
        }

        if (defaultMotion) {
            playingMotionNumber = motionNumber
        } else {
            playingMotionNumber = motionNumber + 1000
        }

        let continueMotion = false // 連続歩行用
        if (defaultMotion) if (continueMotionNumber.indexOf(motionNumber) != -1) continueMotion = true

        let motionFlame = 0
        let motionAdr = 0


        if (defaultMotion) {
            let flameList = ReadEEPROM(256, motionNumber + 1, true)
            motionAdr = 512
            for (let i = 0; i < flameList.length; i++) {
                let check = flameList[i] & 0xFF
                if (i == motionNumber) {
                    motionFlame = check
                } else {
                    motionAdr += check * 22
                }
            }
        } else {
            motionAdr = (56 + motionNumber * 2) * 256
            motionFlame = ReadEEPROM(motionAdr, 1)[0]
            if (motionFlame > 23) motionFlame = 0
            motionAdr++
        }

        if (motionSpeed <= 0) return 0

        for (let f = 0; f < motionFlame; f++) {
            if (continueMotion && f == 0) f = 1
            let motionData = ReadEEPROM(motionAdr + 22 * f, 22, defaultMotion)

            let playMotionId = motionData[0] & 0xFF
            let playMotionFlame = motionData[1] & 0xFF
            let playMotionTime = (motionData[2] & 0xFF) << 8 | (motionData[3] & 0xFF)
            playMotionTime /= motionSpeed / 100
            let playMotionAnglesBuffer = motionData.slice(4, -1)
            let playMotionAngles = []

            for (let i = 0; i < playMotionAnglesBuffer.length; i++) {
                let angle = playMotionAnglesBuffer[i]
                if (angle > 127) angle = -1 * ((~angle & 0xFF) + 1)
                playMotionAngles.push(angle)
            }

            if (playMotionId == motionNumber && playMotionFlame == f) {
                servoAngleGoal = playMotionAngles.slice(0, servoCount)

                if (continueMotion && motionFlame - 1 == f) {
                    for (let i = 0; i < servoCount; i++) continueMotionAngles[i] = servoAngleGoal[i]
                    continueMotionTime = playMotionTime
                } else {
                    LinearServoMoving(playMotionTime)
                }
            } else {
                playingMotionNumber = -1
                return 0
            }
        }
        if (!continueMotion) {
            pause(100)
            ServoFree(-1)
            playingMotionNumber = -1
        }
        return 1
    }

    // 初期位置データを取得
    export function InitEEPROM() {
        if (!initEEPROMFlag) {
            if (Information(InformationData.Version)) {
                initEEPROMFlag = true

                let initDataBuffer = plenbit_full.ReadEEPROM(0, servoCount + 1)
                let initAngles = []
                let count = 0
                for (let i = 0; i < servoCount + 1; i++) {
                    let angle = initDataBuffer[i]
                    if (angle > 127) angle = -1 * ((~angle & 0xFF) + 1)
                    initAngles.push(angle)
                    if (angle == 0) count++
                }

                if (initAngles[0] == 1) {
                    // 初期位置調整済み
                    initAngles.shift()
                    for (let i = 0; i < servoCount; i++) servoInitArray[i] = initAngles[i]
                }
            }
        }
    }

    //PLEN:bit_fullブロック==================================================================
    //ブロック要素==================================================================
    export enum StdMotions {
        //% block="0：Arm Up Down"
        ArmPataPata = 0,
        //% block="1：A hem"
        AHem = 1,
        //% block="2：Bow"
        Bow = 2,
        //% block="3：Propose"
        Propose = 3,
        //% block="4：Hug"
        Hug = 4,
        //% block="5：Clap"
        Clap = 5,
        //% block="6：Highfive"
        HighFive = 6
    }

    export enum WalkMotions {
        //% block="10：Walk Forward"
        WalkForward = 10,
        //% block="11：Walk Back"
        WalkBack = 11,
        //% block="12：Walk Left Turn"
        WalkLTurn = 12,
        //% block="13：Walk Right Turn"
        WalkRTurn = 13,
        //% block="14：Forward Step"
        FStep = 14,
        //% block="15：Back Step"
        BStep = 15,
        //% block="16：Left Step"
        LStep = 16,
        //% block="17：Right Step"
        RStep = 17,
        //% block="17：Left Kick"
        LKick = 18,
        //% block="18：Right Kick"
        RKick = 19
    }

    export enum DanceMotions {
        //% block="20：Dance Forward Step"
        DanceFStep = 20,
        //% block="21：Dance Back Step"
        DanceBStep = 21,
        //% block="22：Dance Left Step"
        DanceLStep = 22,
        //% block="23：Dance Right Step"
        DanceRStep = 23,
        //% block="24：Dance Bow"
        DanceBow = 24,
        //% block="25：Dance Fisnish Pose"
        DanceFisnishPose = 25,
        //% block="26：Dance Up Down"
        DanceUpDown = 26,
        //% block="27：Wiggle Dance"
        WiggleDance = 27,
        //% block="28：Twist Dance"
        TwistDance = 28
    }

    export enum InformationData {
        //% block="Detail"
        Detail = 0,
        //% block="Version"
        Version = 1,
        //% block="Wrote Time"
        Time = 2
    }

    /**
          * Get the time field editor
          * @param ms time duration in milliseconds, eg: 500, 1000
          */
    //% blockId="PLEN:bit_full_picker_servoTime"
    //% block="%ms"
    //% blockHidden=true shim=TD_ID
    //% colorSecondary="#FFFFFF"
    //% ms.fieldEditor="numberdropdown" ms.fieldOptions.decompileLiterals=true
    //% ms.fieldOptions.data='[["100 ms", 100], ["200 ms", 200], ["500 ms", 500], ["1 second", 1000], ["2 seconds", 2000], ["5 seconds", 5000]]'
    export function ServoTimePicker(ms: number): number {
        return ms
    }

    /**
      * Get the time field editor
      */
    //% blockId="PLEN:bit_full_picker_autoPoweroffTime"
    //%block="%min"
    //% blockHidden=true shim=TD_ID
    //% colorSecondary="#FFFFFF"
    //% min.fieldEditor="numberdropdown" min.fieldOptions.decompileLiterals=true
    //% min.fieldOptions.data='[["disable", -1], ["5 minutes", 5], ["10 minutes", 10], ["15 minutes", 15], ["30 minutes", 30], ["1 hour", 60]]'
    export function autopoweroffTimePicker(min: number): number {
        return min
    }

    /**
      * Get the servo number field editor
      */
    //% blockId="PLEN:bit_full_picker_servoNumber"
    //% block="%num"
    //% blockHidden=true shim=TD_ID
    //% colorSecondary="#FFFFFF"
    //% num.fieldEditor="numberdropdown" num.fieldOptions.decompileLiterals=true
    //% num.fieldOptions.data='[["0：L shoulder", 0], ["1：L hip", 1], ["2：L arm", 2], ["3：L hand", 3], ["4：L groin", 4], ["5：L lap", 5], ["6：L knee", 6], ["7：L shin", 7], ["8：L foot", 8],["9：R shoulder", 9], ["10：R hip", 10], ["11：R arm", 11], ["12：R hand", 12], ["13：R groin", 13], ["14：R lap", 14], ["15：R knee", 15], ["16：R shin", 16], ["17：R foot", 17]]'
    export function servoNumberPicker(num: number): number {
        return num
    }

    /**
      * Get the servo number field editor
      */
    //% blockId="PLEN:bit_full_picker_servofreeNumber"
    //% block="%num"
    //% blockHidden=true shim=TD_ID
    //% colorSecondary="#FFFFFF"
    //% num.fieldEditor="numberdropdown" num.fieldOptions.decompileLiterals=true
    //% num.fieldOptions.data='[["All", -1], ["0：L shoulder", 0], ["1：L hip", 1], ["2：L arm", 2], ["3：L hand", 3], ["4：L groin", 4], ["5：L lap", 5], ["6：L knee", 6], ["7：L shin", 7], ["8：L foot", 8],["9：R shoulder", 9], ["10：R hip", 10], ["11：R arm", 11], ["12：R hand", 12], ["13：R groin", 13], ["14：R lap", 14], ["15：R knee", 15], ["16：R shin", 16], ["17：R foot", 17]]'
    export function servofreeNumberPicker(num: number): number {
        return num
    }

    //メイン==================================================================
    //モーション

    /**
     * Play the Standard Motion on PLEN:bit_full.
     */
    //% blockId=PLEN:bit_full_motion_std
    //% block="play std motion %fileName"
    //% weight=10 group="Motion"
    export function PlayStdMotion(fileName: StdMotions) {
        PlayMotion(fileName)
    }

    /**
     * Play the Walk Motion on PLEN:bit_full.
     */
    //% blockId=PLEN:bit_full_motion_walk
    //% block="play walk motion %fileName"
    //% weight=9 group="Motion"
    export function PlayWalkMotion(fileName: WalkMotions) {
        PlayMotion(fileName)
    }

    /**
     * Play the Dance Motion on PLEN:bit_full.
     */
    //% blockId=PLEN:bit_full_motion_dance
    //% block="play dance motion %fileName"
    //% weight=8 group="Motion"
    export function PlayDanceMotion(fileName: DanceMotions) {
        PlayMotion(fileName)
    }

    /**
   * Set Servo Motors to Initial Position.
   */
    //% blockId="PLEN:bit_full_servo_init"
    //% block="set to Initial Position"
    //% weight=7 group="Motion"
    export function ServoInitialSet() {
        for (let i = 0; i < servoCount; i++) {
            ServoWrite(i, 0)
        }
    }

    /**
   * Switch the led eye of PLEN:bit_full.
   */
    //% blockId="PLEN:bit_full_led"
    //% block="set led eyes brightness to %bright percent"
    //% bright.min=0 bright.max=100 bright.defl=50
    //% weight=6 group="LED"
    export function LedEye(bright: number) {
        if (bright < 0) bright = 0
        if (bright > 100) bright = 100
        pins.analogWritePin(AnalogPin.P16, (100 - bright) * 10.23)
    }

    //サーボ==================================================================

    /**
   * Move Servo Motors to set degree.
   */
    //% blockId="PLEN:bit_full_servo_move"
    //% block="move servos to Set Position for %msec msec"
    //% msec.min=100 msec.max=1000 msec.defl=500
    //% msec.shadow="PLEN:bit_full_picker_servoTime"
    //% weight=10 group="Move"
    //% subcategory="Servo"
    export function ServoMove(msec: number) {
        LinearServoMoving(msec)
    }

    /**
   * Move Servo Motors to Initial Position.
   */
    //% blockId="PLEN:bit_full_servo_moveinit"
    //% block="set to Initial Position for %msec msec"
    //% msec.min=100 msec.max=1000 msec.defl=500
    //% msec.shadow="PLEN:bit_full_picker_servoTime"
    //% weight=9 group="Move"
    //% subcategory="Servo"
    export function ServoMoveInit(msec: number) {
        for (let i = 0; i < servoCount; i++) servoAngleGoal[i] = 0
        LinearServoMoving(msec)
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:bit_full_servo_larm"
    //% block="Left Arm      0:shoulder %S0    2:arm %S2  3:hand %S3 degrees"
    //% S0.min=-90 S0.max=90 S0.defl=0
    //% S2.min=0 S2.max=90 S2.defl=0
    //% S3.min=-90 S3.max=90 S3.defl=0
    //% weight=8 group="Left Servo Positions"
    //% subcategory="Servo"
    export function SetLArm(S0: number, S2: number, S3: number) {
        if(S2<0) S2=0
        servoAngleGoal[0] = S0
        servoAngleGoal[2] = S2
        servoAngleGoal[3] = S3
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:bit_full_servo_luleg"
    //% block="Left UpperLeg      1:hip %S1  4:groin %S4   5:lap %S5 degrees"
    //% S1.min=-90 S1.max=90 S1.defl=0
    //% S4.min=-60 S4.max=20 S4.defl=0
    //% S5.min=-90 S5.max=90 S5.defl=0
    //% weight=7 group="Left Servo Positions"
    //% subcategory="Servo"
    export function SetLUpperLeg(S1: number, S4: number, S5: number) {
        if (S4 < -60) S4 = -60
        if (S4 > 20) S4 = 20
        servoAngleGoal[1] = S1
        servoAngleGoal[4] = S4
        servoAngleGoal[5] = S5
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:bit_full_servo_llleg"
    //% block="Left LowerLeg     6:knee %S6   7:shin %S7  8:foot %S8 degrees"
    //% S6.min=-90 S6.max=0 S6.defl=0
    //% S7.min=-90 S7.max=90 S7.defl=0
    //% S8.min=-20 S8.max=90 S8.defl=0
    //% weight=6 group="Left Servo Positions"
    //% subcategory="Servo"
    export function SetLLowerLeg(S6: number, S7: number, S8: number) {
        if (S6 < 0) S6 = 0
        servoAngleGoal[6] = S6
        servoAngleGoal[7] = S7
        servoAngleGoal[8] = S8
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:bit_full_servo_rarm"
    //% block="Right Arm     9:shoulder %S9   11:arm %S11 12:hand %S12 degrees"
    //% S9.min=-90 S9.max=90 S9.defl=0
    //% S11.min=0 S11.max=90 S11.defl=0
    //% S12.min=-90 S12.max=90 S12.defl=0
    //% weight=5 group="Right Servo Positions"
    //% subcategory="Servo"
    export function SetRArm(S9: number, S11: number, S12: number) {
        if (S11 < 0) S11 = 0
        servoAngleGoal[9] = S9
        servoAngleGoal[11] = S11
        servoAngleGoal[12] = S12
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:bit_full_servo_ruleg"
    //% block="Right UpperLeg    10:hip %S10 13:groin %S13  14:lap %S14 degrees"
    //% S10.min=-90 S10.max=90 S10.defl=0
    //% S13.min=-60 S13.max=20 S13.defl=0
    //% S14.min=-90 S14.max=90 S14.defl=0
    //% weight=4 group="Right Servo Positions"
    //% subcategory="Servo"
    export function SetRUpperLeg(S10: number, S13: number, S14: number) {
        if (S13 < -60) S13 = -60
        if (S13 > 20) S13 = 20
        servoAngleGoal[10] = S10
        servoAngleGoal[13] = S13
        servoAngleGoal[14] = S14
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:bit_full_servo_rlleg"
    //% block="Right LowerLeg   15:knee %S15  16:shin %S16 17:foot %S17 degrees"
    //% S15.min=-90 S15.max=0 S15.defl=0
    //% S16.min=-90 S16.max=90 S16.defl=0
    //% S17.min=-20 S17.max=90 S17.defl=0
    //% weight=3 group="Right Servo Positions"
    //% subcategory="Servo"
    export function SetRLowerLeg(S15: number, S16: number, S17: number) {
        if (S15 < 0) S15 = 0
        if (S17 < -20) S17 = -20
        servoAngleGoal[15] = S15
        servoAngleGoal[16] = S16
        servoAngleGoal[17] = S17
    }

    //発展==================================================================
    /**
   * Play the Motion on PLEN:bit_full.
   * You can check the list of Motion Number at GitHub.
   * @param motionNumber https://github.com/plenprojectcompany/pxt-PLENbit_full
   */
    //% blockId=PLEN:bit_full_motion_play
    //% block="play motion %fileName"
    //% motionNumber.min=0 motionNumber.max=255 motionNumber.defl=0
    //% weight=11 group="Servo"
    //% subcategory="more"
    export function PlayMotion(motionNumber: number) {
        DoMotion(motionNumber)
    }

    /**
   * Change the playing speed of the PLEN:bit_full motion.
   */
    //% blockId=PLEN:bit_full_motion_speed
    //% block="set motion speed to %speed percent"
    //% speed.min=10 speed.max=300 speed.defl=100
    //% weight=10 group="Servo"
    //% subcategory="more"
    export function SetMotionSpeed(speed: number) {
        motionSpeed = speed
    }

    /**
   * Controll the each servo motors. The servo will move max speed.
   */
    //% blockId="PLEN:bit_full_servo"
    //% block="set the servo motor %num to %degrees degrees"
    //% num.min=0 num.max=17 num.defl=0
    //% num.shadow="PLEN:bit_full_picker_servoNumber"
    //% degrees.min=-90 degrees.max=90 degrees.defl=0
    //% weight=9 group="Servo"
    //% subcategory="more"
    export function ServoWrite(num: number, degrees: number) {
        ServoControl(num, degrees)
        servoAngleGoal[num] = degrees
    }

    /**
   * Set Servo Motors to free.
   */
    //% blockId="PLEN:bit_full_servo_free"
    //% block="free the servo motor %num"
    //% num.defl=-1
    //% num.shadow="PLEN:bit_full_picker_servofreeNumber"
    //% weight=8 group="Servo"
    //% subcategory="more"
    export function ServoFree(num: number) {
        if (num >= 0) {
            ServoControl(num, 0, true)
        } else {
            // 全サーボをフリーにする
            WritePCA9865(0xFA, 0x00) // ALL_LED_ON_L　全PWMのONのタイミングを0にする
            WritePCA9865(0xFB, 0x00) // ALL_LED_ON_H　　　　　　　〃
            WritePCA9865(0xFC, 0x00) // ALL_LED_OFF_L　全PWMのOFFのタイミングを0にする
            WritePCA9865(0xFD, 0x00) // ALL_LED_OFF_H　　　　　　　〃
            ServoControl(8, 0, true)
            ServoControl(17, 0, true)
        }
    }

    /**
   * Recording Original Motion on PLEN:bit_full. Max 23 flames each motion.
   * @param motionNumber 0～99
   */
    //% blockId=PLEN:bit_full_originalmotion_recording
    //% block="recoding original motion %fileName"
    //% motionNumber.min=0 motionNumber.max=99 motionNumber.defl=0
    //% weight=7 group="Original Motion"
    //% subcategory="more"
    export function RecodingOriginalMotion(motionNumber: number) {
        if (recordingFlag == -1) {
            basic.showString("R")
            if (motionNumber < 0 || motionNumber > 99) motionNumber = -1
            recordingFlag = motionNumber

            let motionAdr = (56 + recordingFlag * 2) * 256
            WriteEEPROM(motionAdr, [0])
            basic.clearScreen()
        }
    }

    /**
   * Stop Recording the Original Motion on PLEN:bit_full.
   */
    //% blockId=PLEN:bit_full_originalmotion_stop
    //% block="stop recoding"
    //% weight=6 group="Original Motion"
    //% subcategory="more"
    export function StopRecodingOriginalMotion() {
        if (recordingFlag != -1) {
            basic.pause(100)
            recordingFlag = -1
            basic.showIcon(IconNames.Yes)
        }
    }

    /**
   * Play the Original Motion on PLEN:bit_full.
   * @param motionNumber 0～99
   */
    //% blockId=PLEN:bit_full_originalmotion
    //% block="play original motion %fileName"
    //% motionNumber.min=0 motionNumber.max=99 motionNumber.defl=0
    //% weight=5 group="Original Motion"
    //% subcategory="more"
    export function PlayOriginalMotion(motionNumber: number) {
        DoMotion(motionNumber, false)
    }

    /**
   * Power off PLEN:bit_full.
   */
    //% blockId="PLEN:bit_full_system_power"
    //% block="turn %flag PLEN:bit_full"
    //% flag.defl=false
    //% flag.shadow="toggleOnOff"
    //% weight=4 group="Power"
    //% subcategory="more"
    export function Power(flag: boolean) {
        let state = 0
        if (flag) state = 1

        pins.digitalWritePin(DigitalPin.P1, state)
        pause(20)

        if (flag) PLENStartInit()
        else PLENEndInit()
    }

    /**
   * Set auto power-off time of PLEN:bit_full. 30 minutes is default.
   */
    //% blockId="PLEN:bit_full_system_autopoweroff"
    //% block="auto power-off %min minutes after PLEN:bit_full power on"
    //% min.min=-1 min.defl=30
    //% min.shadow="PLEN:bit_full_picker_autoPoweroffTime"
    //% weight=3 group="Power"
    //% subcategory="more"
    export function AutoPowerOff(min: number) {
        if (autoPoweroffTime > 0) {
            autoPoweroffTime = min * 60000
        } else {
            autoPoweroffTime = -1
        }
    }

    //メンテナンス用==================================================================
    // バージョン確認
    /**
      * Check the Motion Data information from EEPROM.
      */
    //% blockId="PLEN:bit_full_maintenance_info"
    //% block="Check %data"
    //% weight=10 group="Motion Data"
    //% subcategory="Maintenance"
    //% deprecated=true
    export function Information(data: InformationData) {
        let dataBuffer = ReadEEPROM(0, 256, true)
        let final = dataBuffer.indexOf(Buffer.create(0))
        let dataJSON = JSON.parse(dataBuffer.slice(0, final).toString())
        let key: string
        if (data == 1) {
            key = 'ver'
        } else if (data == 2) {
            key = 'time'
        } else {
            key = 'detail'
        }
        if (dataJSON) {
            return dataJSON[key]
        } else {
            return false
        }
    }

    // 初期位置調整
    /**
      * Save the servo initial position to the EEPROM.
      */
    //% blockId="PLEN:bit_full_servoadjust_save"
    //% block="save the initial position"
    //% weight=9 group="Servo Adjust"
    //% subcategory="Maintenance"
    //% deprecated=true
    export function SaveInitPosition() {
        // 初期位置データ書き込み
        plenbit_full.WriteEEPROM(0, [1].concat(servoInitArray))
    }

    /**
      * Delete the servo initial position from the EEPROM.
      */
    //% blockId="PLEN:bit_full_servoadjust_delete"
    //% block="reset the initial position"
    //% weight=8 group="Servo Adjust"
    //% subcategory="Maintenance"
    //% deprecated=true
    export function ResetInitPosition() {
        // 初期位置データ削除
        let array = []
        for (let i = 0; i < servoCount + 1; i++)array.push(0)
        for (let i = 0; i < servoCount; i++) servoInitArray[i] = 0
        plenbit_full.WriteEEPROM(0, array)
    }
}
