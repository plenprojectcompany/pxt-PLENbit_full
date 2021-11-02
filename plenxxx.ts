//plenxxx.ts

/**
 * Blocks for PLEN:xxx
 */
//% weight=999 color=#00A654 icon="\uf0a0" block="PLEN:xxx"
//% groups=['Motion', 'Sensor', 'Servo', 'LED', 'others']
namespace plenxxx {
    export enum LedOnOff {
        //% block="on"
        On = 0,
        //% block="off"
        Off = 1
    }

    export enum PowerOnOff {
        //% block="off"
        Off = 0,
        //% block="on"
        On = 1
    }

    export let servoInitArray: number[] = [0, 10, 0, -15, -10, -10, 20, -20, -15, -20, -10, 25, -30, 10, -15, 0, 0, -10]
    const servoReverse = [true, true, false, true, false, true, true, false, true, false, false, true, false, true, false, false, true, false] //サーボ反転
    let servoAngle: number[] = []
    for (let i = 0; i < servoInitArray.length; i++) servoAngle.push(0)
    const PCA9865Adr = 0x6A
    let initPCA9865Flag = false
    let hardwareVersion = parseInt(control.hardwareVersion())

    // PLEN起動
    Power(1)

    function PLENStartInit(){
        // 各種初期化（電源オン時の初期動作）
        EyeLed(LedOnOff.On)
        ServoInitialSet()
        basic.pause(500)
        ServoFree()
    }

    function PLENEndInit() {
        // 各種初期化（電源オフ時の初期化）
        EyeLed(LedOnOff.Off)
        initPCA9865Flag = false
    }

    export function InitPCA9865() { // PCA9685の初期設定
        if (ReadPCA9865(0xFE) != 0x00) { // PRE_SCALEが読み取れる <=> PCA9865が接続済み
            initPCA9865Flag = true
            WritePCA9865(0x00, 0x10) // Sleep modeをONにして、内部クロックを停止
            WritePCA9865(0xFE, 0x85) // PRE_SCALEを設定　※ cf.P13 Writes to PRE_SCALE register are blocked when SLEEP xxx is logic 0 (MODE 1)
            WritePCA9865(0x00, 0x00) // Sleep modeをOFFにして、内部クロックをPRE_SCALEで動かす

            pins.analogSetPeriod(AnalogPin.P2, 20000)
            pins.analogSetPeriod(AnalogPin.P8, 20000)
            ServoFree()
        }
    }

    function ReadPCA9865(addr: number) {
        pins.i2cWriteNumber(PCA9865Adr, addr, NumberFormat.UInt8LE, false)
        return pins.i2cReadNumber(PCA9865Adr, NumberFormat.UInt8LE, false)
    }

    function WritePCA9865(addr: number, d: number) {
        let cmd = pins.createBuffer(2);
        cmd[0] = addr;
        cmd[1] = d;
        pins.i2cWriteBuffer(PCA9865Adr, cmd, false);
    }

    export function ServoControl(num: number, degrees: number) {
        servoAngle[num] = degrees

        if (initPCA9865Flag == false) InitPCA9865()

        degrees += servoInitArray[num]
        if (servoReverse[num]) {
            degrees *= -1
        }

        let msec = 2000 / 180 * (degrees + 90) + 500
        if (msec < 500) msec = 500
        if (msec >= 2500) msec = 2500
        let pwm = Math.round(msec / 20000 * 4096)
        if (pwm < 102) pwm = 102
        if (pwm >= 512) pwm = 511


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

    function ServoFree() {
        //Power Free!
        WritePCA9865(0xFA, 0x00) // ALL_LED_ON_L　全PWMのONのタイミングを0にする
        WritePCA9865(0xFB, 0x00) // ALL_LED_ON_H　　　　　　　〃
        WritePCA9865(0xFC, 0x00) // ALL_LED_OFF_L　全PWMのOFFのタイミングを0にする
        WritePCA9865(0xFD, 0x00) // ALL_LED_OFF_H　　　　　　　〃
        pins.digitalWritePin(DigitalPin.P2, 0)
        pins.digitalWritePin(DigitalPin.P8, 0)
    }

    //PLEN:xxxブロック
    /**
   * Controll the each servo motors. The servo will move max speed.
   * @param speed 0 ~ 50, The larger this value, the faster.
   */
    //% blockId=PLEN:xxx_servo
    //% block="servo motor %num|number %degrees|degrees"
    //% num.min=0 num.max=17
    //% degrees.min=-90 degrees.max=90 degrees.defl=0
    //% weight=8 group="Servo"
    export function ServoWrite(num: number, degrees: number) {
        ServoControl(num, degrees)
    }

    /**
   * Switch the eye led of PLEN:xxx.
   */
    //% blockId=PLEN:xxx_led
    //% block="eye led is %state"
    //% weight=10 group="LED"
    export function EyeLed(state: LedOnOff) {
        pins.digitalWritePin(DigitalPin.P16, state);
    }

    /**
   * Set Servo Motors to initial position.
   */
    //% blockId=PLEN:xxx_servo_init
    //% block="servo motor initial"
    //% weight=3 group="Motion"
    export function ServoInitialSet() {
        for (let n = 0; n < 18; n++) {
            ServoWrite(n, 0)
        }
    }

    /**
   * Power off PLEN:xxx.
   */
    //% blockId=PLEN:xxx_system_power
    //% block="power %state"
    //% weight=3 group="others"
    export function Power(state: PowerOnOff) {
        pins.digitalWritePin(DigitalPin.P1, state)
        if (state == PowerOnOff.On){
            pins.setPull(DigitalPin.P1, PinPullMode.PullUp)
            PLENStartInit()
        }else{
            pins.setPull(DigitalPin.P1, PinPullMode.PullDown)
            PLENEndInit()
        }
    }
}
