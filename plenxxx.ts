//plenxxx.ts

/**
 * Blocks for PLEN:xxx
 */
//% weight=999 color=#00A654 icon="\uf0a0" block="PLEN:xxx"
//% groups=['Motion', 'Sensor', 'Servo', 'LED', 'Power', 'Others']
namespace plenxxx {

    //グローバル変数==================================================================
    export let servoInitArray: number[] = [0, 10, 0, -15, -10, -10, 20, -20, -15, -20, -10, 25, -30, 10, -15, 0, 0, -10]
    const servoReverse = [true, true, false, true, false, true, true, false, true, false, false, true, false, true, false, false, true, false] //サーボ反転
    const servoCount = servoInitArray.length
    let servoAngle: number[] = []
    for (let i = 0; i < servoCount; i++) servoAngle.push(0)
    let servoFreeArray: boolean[] = []
    for (let i = 0; i < servoCount; i++) servoFreeArray.push(true)
    let servoAngleGoal: number[] = []
    for (let i = 0; i < servoCount; i++) servoAngle.push(0)
    const PCA9865Adr = 0x6A
    const eepromAdr = 0x55
    let servoInitAdr = 0
    let initEEPROMFlag = false
    let initPCA9865Flag = false
    let backgroundProcessFlag = false
    let autoPoweroffFlag = true
    let autoPoweroffTimeSet = 30 //min　（マイナス指定で無効）
    let autoPoweroffStartTime = -1
    let hardwareVersion = parseInt(control.hardwareVersion())

    class EEPROM {
        head: number
        end: number
        constructor(head: number, end: number) {
            this.head = head
            this.end = end
        }

        AddData(num:number){

        }

        DeleteData(num: number) {

        }
    }

    let motionDataEEPROM = new EEPROM(10, 20)


    input.onButtonPressed(Button.A, function() {
        WriteEEPROM(500,255)
    })

    input.onButtonPressed(Button.B, function () {

        serial.writeValue("x", ReadEEPROM(500, 1).getNumber(NumberFormat.UInt8LE,0))
    })

    //初期動作==================================================================
    // PLEN起動
    Power(true)


    //関数==================================================================
    function BackgroundProcess(){ // バックグラウンド処理
        if (backgroundProcessFlag) return 0
        backgroundProcessFlag = true

        control.inBackground(function () {
            while (true) {
                basic.pause(60000) // 毎分確認
                if (control.millis() - autoPoweroffStartTime >= autoPoweroffTimeSet * 60000 && autoPoweroffTimeSet > 0 && autoPoweroffStartTime > 0) {
                    basic.showString("AUTO POWER OFF", 75)
                    plenxxx.Power(false) // オートパワーオフ
                }
            }
        })
        return 1
    }

    function PLENStartInit() { // 各種初期化（電源オン時の初期動作）
        autoPoweroffStartTime = control.millis()
        LedEye(true)
        InitPCA9865()
        BackgroundProcess()

        basic.showIcon(IconNames.Happy)
        basic.clearScreen()
    }

    function PLENEndInit() { // 各種初期化（電源オフ時の初期化）
        LedEye(false)
        initPCA9865Flag = false
        autoPoweroffStartTime = -1

        basic.showIcon(IconNames.Asleep)
    }

    export function InitPCA9865() { // PCA9685の初期設定
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

    function ReadPCA9865(addr: number) { // PCA9685を読む
        pins.i2cWriteNumber(PCA9865Adr, addr, NumberFormat.UInt8LE, false)
        return pins.i2cReadNumber(PCA9865Adr, NumberFormat.UInt8LE, false)
    }

    function WritePCA9865(addr: number, d: number) { // PCA9685に書く
        let cmd = pins.createBuffer(2);
        cmd[0] = addr;
        cmd[1] = d;
        pins.i2cWriteBuffer(PCA9865Adr, cmd, false);
    }

    export function ReadEEPROM(eepAdr: number, num: number) { // EEPROMを読む
        let data = pins.createBuffer(2);
        data[0] = eepAdr >> 8;
        data[1] = eepAdr & 0xFF;
        // need adr change code
        pins.i2cWriteBuffer(eepromAdr, data);
        return pins.i2cReadBuffer(eepromAdr, num, false);
    }

    function WriteEEPROM(eepAdr: number, num: number) { // EEPROMに書く
        let data = pins.createBuffer(3);
        data[0] = eepAdr >> 8;
        data[1] = eepAdr & 0xFF;
        data[2] = num;
        pins.i2cWriteBuffer(eepromAdr, data);
        basic.pause(5)
    }

    export function ServoControl(num: number, degrees: number, free:boolean) { // サーボ角を最短で変更する
        if (initPCA9865Flag == false) InitPCA9865()

        degrees = Math.round(degrees)
        if (degrees < -90) degrees = 90
        if (degrees > 90) degrees = 90

        if (servoAngle[num] != degrees || servoFreeArray[num] != free) { // 角度変化の無いサーボは動かさない（脱力サーボは動かす）
            let msec = 0
            let pwm = 0

            if (free == false){ // サーボフリーの場合、PWMは0
                servoAngle[num] = degrees
                servoFreeArray[num] = false

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
    }

    function LinearServoMoving(msec: number) { // サーボモーターを指定角度servoAngleGoal[]まで線形的に変更
        const startTime = input.runningTime()
        let startAngle: number[] = []
        let step: number[] = []
        for (let i = 0; i < servoCount; i++) {
            const angle = servoAngle[i]
            startAngle.push(angle)
            step.push((servoAngleGoal[i] - angle) / msec)
        }

        let loop = true
        while (loop) {
            const deltaTime = input.runningTime() - startTime
            for (let i = 0; i < servoCount; i++) {
                ServoControl(i, startAngle[i] + step[i] * deltaTime,false)
                if (deltaTime >= msec) {
                    loop = false
                    break
                }
            }
        }
    }

    //PLEN:xxxブロック==================================================================
    //ブロック要素==================================================================
    /**
      * Get the time field editor
      * @param ms time duration in milliseconds, eg: 500, 1000
      */
    //% blockId="PLEN:xxx_picker_servoTime"
    //% block="%ms"
    //% blockHidden=true shim=TD_ID
    //% colorSecondary="#FFFFFF"
    //% ms.fieldEditor="numberdropdown" ms.fieldOptions.decompileLiterals=true
    //% ms.fieldOptions.data='[["100 ms", 100], ["200 ms", 200], ["500 ms", 500], ["1 second", 1000], ["2 seconds", 2000], ["5 seconds", 5000]]'
    export function ServoTimePicker(ms: number): number {
        return ms;
    }

    /**
      * Get the time field editor
      */
    //% blockId="PLEN:xxx_picker_autoPoweroffTime"
    //%block="%min"
    //% blockHidden=true shim=TD_ID
    //% colorSecondary="#FFFFFF"
    //% min.fieldEditor="numberdropdown" min.fieldOptions.decompileLiterals=true
    //% min.fieldOptions.data='[["deactivate", -1], ["5 minutes", 5], ["10 minutes", 10], ["15 minutes", 15], ["30 minutes", 30], ["1 hour", 60]]'
    export function autopoweroffTimePicker(min: number): number {
        return min;
    }

    /**
      * Get the servo number field editor
      */
    //% blockId="PLEN:xxx_picker_servoNumber"
    //% block="%num"
    //% blockHidden=true shim=TD_ID
    //% colorSecondary="#FFFFFF"
    //% num.fieldEditor="numberdropdown" num.fieldOptions.decompileLiterals=true
    //% num.fieldOptions.data='[["0：L shoulder", 0], ["1：L groin", 1], ["2：L arm", 2], ["3：L hand", 3], ["4：L leg", 4], ["5：L lap", 5], ["6：L knee", 6], ["7：L shin", 7], ["8：L foot", 8],["9：R shoulder", 9], ["10：R groin", 10], ["11：R arm", 11], ["12：R hand", 12], ["13：R leg", 13], ["14：R lap", 14], ["15：R knee", 15], ["16：R shin", 16], ["17：R foot", 17]]'
    export function servoNumberPicker(num: number): number {
        return num;
    }

    /**
      * Get the servo number field editor
      */
    //% blockId="PLEN:xxx_picker_servofreeNumber"
    //% block="%num"
    //% blockHidden=true shim=TD_ID
    //% colorSecondary="#FFFFFF"
    //% num.fieldEditor="numberdropdown" num.fieldOptions.decompileLiterals=true
    //% num.fieldOptions.data='[["All", -1], ["0：L shoulder", 0], ["1：L groin", 1], ["2：L arm", 2], ["3：L hand", 3], ["4：L leg", 4], ["5：L lap", 5], ["6：L knee", 6], ["7：L shin", 7], ["8：L foot", 8],["9：R shoulder", 9], ["10：R groin", 10], ["11：R arm", 11], ["12：R hand", 12], ["13：R leg", 13], ["14：R lap", 14], ["15：R knee", 15], ["16：R shin", 16], ["17：R foot", 17]]'
    export function servofreeNumberPicker(num: number): number {
        return num;
    }

    //メイン==================================================================
    /**
   * Set Servo Motors to initial Position.
   */
    //% blockId="PLEN:xxx_servo_init"
    //% block="set to initial Position"
    //% weight=3 group="Motion"
    export function ServoInitialSet() {
        for (let i = 0; i < 18; i++) {
            ServoWrite(i, 0)
        }
    }

    /**
   * Switch the led eye of PLEN:xxx.
   */
    //% blockId="PLEN:xxx_led"
    //% block="turn %flag the led eyes"
    //% flag.defl=true
    //% flag.shadow="toggleOnOff"
    //% weight=10 group="LED"
    export function LedEye(flag: boolean) {
        let state = 1
        if (flag) state = 0
        pins.digitalWritePin(DigitalPin.P16, state);
    }

    //サーボ==================================================================

    /**
   * Move Servo Motors to set degree.
   */
    //% blockId="PLEN:xxx_servo_move"
    //% block="move servos to the set positions in %msec msec"
    //% msec.min=100 msec.max=1000 msec.defl=500
    //% msec.shadow="PLEN:xxx_picker_servoTime"
    //% weight=90 group="Move"
    //% subcategory="Servo"
    export function ServoMove(msec: number) {
        LinearServoMoving(msec)
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:xxx_servo_larm"
    //% block="Left Arm      0:shoulder %S0    2:arm %S2   3:hand %S3 degrees"
    //% S0.min=-90 S0.max=90 S0.defl=0
    //% S2.min=0 S2.max=90 S2.defl=0
    //% S3.min=-90 S3.max=90 S3.defl=0
    //% weight=80 group="Left Servos Positions"
    //% subcategory="Servo"
    export function SetLArm(S0: number, S2: number, S3: number) {
        servoAngleGoal[0] = S0
        servoAngleGoal[2] = S2
        servoAngleGoal[3] = S3
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:xxx_servo_luleg"
    //% block="Left UpperLeg    1:groin %S1    4:leg %S4    5:lap %S5 degrees"
    //% S1.min=-90 S1.max=90 S1.defl=0
    //% S4.min=-60 S4.max=60 S4.defl=0
    //% S5.min=-90 S5.max=90 S5.defl=0
    //% weight=70 group="Left Servos Positions"
    //% subcategory="Servo"
    export function SetLUpperLeg(S1: number, S4: number, S5: number) {
        servoAngleGoal[1] = S1
        servoAngleGoal[4] = S4
        servoAngleGoal[5] = S5
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:xxx_servo_llleg"
    //% block="Left LowerLeg     6:knee %S6   7:shin %S7   8:foot %S8 degrees"
    //% S6.min=-90 S6.max=30 S6.defl=0
    //% S7.min=-90 S7.max=90 S7.defl=0
    //% S8.min=-90 S8.max=30 S8.defl=0
    //% weight=60 group="Left Servos Positions"
    //% subcategory="Servo"
    export function SetLLowerLeg(S6: number, S7: number, S8: number) {
        servoAngleGoal[6] = S6
        servoAngleGoal[7] = S7
        servoAngleGoal[8] = S8
    }

    /**
   * Set Servo Motors to free.
   */
    //% blockId="PLEN:xxx_servo_rarm"
    //% block="Right Arm     9:shoulder %S9   11:arm %S11  12:hand %S12 degrees"
    //% S9.min=-90 S9.max=90 S9.defl=0
    //% S11.min=0 S11.max=90 S11.defl=0
    //% S12.min=-90 S12.max=90 S12.defl=0
    //% weight=50 group="Right Servos Positions"
    //% subcategory="Servo"
    export function SetRArm(S9: number, S11: number, S12: number) {
        servoAngleGoal[9] = S9
        servoAngleGoal[11] = S11
        servoAngleGoal[12] = S12
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:xxx_servo_ruleg"
    //% block="Right UpperLeg  10:groin %S10   13:leg %S13   14:lap %S14 degrees"
    //% S10.min=-90 S10.max=90 S10.defl=0
    //% S13.min=-60 S13.max=60 S13.defl=0
    //% S14.min=-90 S14.max=90 S14.defl=0
    //% weight=40 group="Right Servos Positions"
    //% subcategory="Servo"
    export function SetRUpperLeg(S10: number, S13: number, S14: number) {
        servoAngleGoal[10] = S10
        servoAngleGoal[13] = S13
        servoAngleGoal[14] = S14
    }

    /**
   * Set Servo Motors degree.
   */
    //% blockId="PLEN:xxx_servo_rlleg"
    //% block="Right LowerLeg   15:knee %S15  16:shin %S16  17:foot %S17 degrees"
    //% S15.min=-90 S15.max=30 S15.defl=0
    //% S16.min=-90 S16.max=90 S16.defl=0
    //% S17.min=-90 S17.max=30 S17.defl=0
    //% weight=30 group="Right Servos Positions"
    //% subcategory="Servo"
    export function SetRLowerLeg(S15: number, S16: number, S17: number) {
        servoAngleGoal[15] = S15
        servoAngleGoal[16] = S16
        servoAngleGoal[17] = S17
    }

    //発展==================================================================
    /**
   * Controll the each servo motors. The servo will move max speed.
   * @param speed 0 ~ 50, The larger this value, the faster.
   */
    //% blockId="PLEN:xxx_servo"
    //% block="set the servo motor %num to %degrees degrees"
    //% num.min=0 num.max=17 num.defl=0
    //% num.shadow="PLEN:xxx_picker_servoNumber"
    //% degrees.min=-90 degrees.max=90 degrees.defl=0
    //% weight=8 group="Servo"
    //% subcategory="Advanced"
    export function ServoWrite(num: number, degrees: number) {
        ServoControl(num, degrees,false)
        servoAngleGoal[num] = degrees
    }

    /**
   * Set Servo Motors to free.
   */
    //% blockId="PLEN:xxx_servo_free"
    //% block="free the servo motor %num"
    //% num.defl=-1
    //% num.shadow="PLEN:xxx_picker_servofreeNumber"
    //% weight=4 group="Servo"
    //% subcategory="Advanced"
    export function ServoFree(num:number) {
        if(num >= 0){
            ServoControl(num,0,true)
            servoFreeArray[num] = true
        }else{
            // 全サーボをフリーにする
            WritePCA9865(0xFA, 0x00) // ALL_LED_ON_L　全PWMのONのタイミングを0にする
            WritePCA9865(0xFB, 0x00) // ALL_LED_ON_H　　　　　　　〃
            WritePCA9865(0xFC, 0x00) // ALL_LED_OFF_L　全PWMのOFFのタイミングを0にする
            WritePCA9865(0xFD, 0x00) // ALL_LED_OFF_H　　　　　　　〃
            pins.digitalWritePin(DigitalPin.P2, 0)
            pins.digitalWritePin(DigitalPin.P8, 0)

            for (let i = 0; i < servoCount; i++) servoFreeArray[i] = true
        }
    }

    /**
   * Power off PLEN:xxx.
   */
    //% blockId="PLEN:xxx_system_power"
    //% block="turn %flag PLEN:xxx"
    //% flag.defl=false
    //% flag.shadow="toggleOnOff"
    //% weight=3 group="Power"
    //% subcategory="Advanced"
    export function Power(flag: boolean) {
        let state = 0
        if (flag) state = 1
        pins.digitalWritePin(DigitalPin.P1, state)

        if (flag) PLENStartInit()
        else PLENEndInit()
    }

    /**
   * Set auto power-off time of PLEN:xxx. 30 minutes is default.
   */
    //% blockId="PLEN:xxx_system_autopoweroff"
    //% block="auto power-off %min minutes after PLEN:xxx power on"
    //% min.min=-1 min.defl=30
    //% min.shadow="PLEN:xxx_picker_autoPoweroffTime"
    //% weight=2 group="Power"
    //% subcategory="Advanced"
    export function AutoPowerOff(min: number) {
        autoPoweroffTimeSet = min
    }

    //初期位置調整==================================================================
    /**
   * Save the servo initial position to the EEPROM.
   */
    //% blockId="PLEN:xxx_servoadjust_save"
    //% block="set the initial position of servo motor %num to %degrees degrees"
    //% weight=2
    //% subcategory="Servo Adjust"
    export function SaveServoInit(num: number,degrees:number) {
        if (num >= 0 && num < 18){
            WriteEEPROM(servoInitAdr + num, degrees)
        }
    }
}
