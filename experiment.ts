// 逆運動学
class KI {
    angle_4 = 0
    angle_5 = 0
    angle_6 = 0
    angle_7 = 0
    angle_8 = 0

    timelist:number[] = []
    anglelist: number[][] = []

    constructor() {
        let angle_4 = 0
    }

    CalcFoot(H_F: number, W_F: number, pitch = 0, roll = 0, mode = 2) { // mode0･･･後ろ mode1･･･後ろ曲げ mode2･･･前曲げ mode4･･･前
        let wai = 15
        let hip = 10
        let thi = 28
        let shi = 28.5
        let ank = 10
        let f = 15

        let lfb = 25
        let lff = 20
        let lfr = 13
        let lfl = 28

        let length = 0
        if (pitch != 0) {
            if(mode == 0){
                pitch *= -1
            }

            if (pitch > 0) {
                length = lfb
            } else {
                length = lff
            }

            let angle = Math.abs(this.DtoR(pitch))

            H_F += (length - (ank + f) * Math.tan(angle / 2)) * Math.sin(angle)
        }
        if (roll != 0) {
            if (roll > 0) {
                length = lfr
            } else {
                length = lfl
            }

            let angle = Math.abs(this.DtoR(roll))

            H_F += (length - f * Math.tan(angle / 2)) * Math.sin(angle)
        }

        let H_L2 = hip + thi + shi + ank - H_F
        let H_L = H_L2 - (hip + ank)
        let L = 0

        if (mode == 1 || mode == 2){
            L = Math.sqrt(H_L2 ** 2 + W_F ** 2) - (hip + ank)
        }else{
            L = thi + shi
        }

        this.angle_4 = this.RtoD(Math.atan(W_F / H_L2))
        this.angle_8 = this.angle_4
        let alpha = this.RtoD(Math.acos((L ** 2 + thi ** 2 - shi ** 2) / (2 * L * thi)))
        let beta = this.RtoD(Math.acos((L ** 2 + shi ** 2 - thi ** 2) / (2 * L * shi)))
        let ganma = this.RtoD(Math.acos(H_L / L))

        this.angle_5 = alpha + ganma
        if (mode == 1) this.angle_5 = alpha - ganma
        this.angle_6 = -(alpha + beta)
        this.angle_7 = beta - ganma
        if(mode == 1) this.angle_7 = beta + ganma

        this.angle_7 += pitch
        this.angle_8 -= roll

        //this.angle_5 += this.angle_5 * 0.35

        if (mode == 0) {
            this.angle_5 *= -1
            this.angle_7 *= -1
        }

        if (isNaN(this.angle_4)) basic.showString("E4")
        if (isNaN(this.angle_5)) basic.showString("E5")
        if (isNaN(this.angle_6)) basic.showString("E6")
        if (isNaN(this.angle_7)) basic.showString("E7")
        if (isNaN(this.angle_8)) basic.showString("E8")

        this.angle_6 += Math.abs(this.angle_6) * 0.14 // バランス調整

        this.angle_4 = Math.round(this.angle_4)
        this.angle_5 = Math.round(this.angle_5)
        this.angle_6 = Math.round(this.angle_6)
        this.angle_7 = Math.round(this.angle_7)
        this.angle_8 = Math.round(this.angle_8)
    }

    SetL() {
        plenbit_full.servoAngleGoal[4] = this.angle_4
        plenbit_full.servoAngleGoal[5] = this.angle_5
        plenbit_full.servoAngleGoal[6] = this.angle_6
        plenbit_full.servoAngleGoal[7] = this.angle_7
        plenbit_full.servoAngleGoal[8] = this.angle_8
    }

    SetR() {
        plenbit_full.servoAngleGoal[13] = this.angle_4
        plenbit_full.servoAngleGoal[14] = this.angle_5
        plenbit_full.servoAngleGoal[15] = this.angle_6
        plenbit_full.servoAngleGoal[16] = this.angle_7
        plenbit_full.servoAngleGoal[17] = this.angle_8
    }


    Flip(){
        for(let i=0;i<9;i++){
            let check = plenbit_full.servoAngleGoal[i]
            plenbit_full.servoAngleGoal[i] = plenbit_full.servoAngleGoal[i + 9]
            plenbit_full.servoAngleGoal[i+9] = check
        }
    }


    Move(msec: number) {
        serial.writeLine(msec.toString())
        serial.writeNumbers(plenbit_full.servoAngleGoal)
        plenbit_full.ServoMove(msec)
        //this.timelist.push(msec)
        //this.anglelist.push(plenbit_full.servoAngleGoal.slice())
    }

    Bezier(){
        this.anglelist.push(this.anglelist[this.anglelist.length - 1].slice())
        for(let i = 0;i<this.timelist.length;i++){
            serial.writeNumbers(this.anglelist[i])
            BezierServoMoving(this.anglelist[i], this.anglelist[i+1], this.timelist[i])
        }
        this.timelist = []
        this.anglelist = []
    }

    DtoR(deg: number) {
        return deg * Math.PI / 180
    }

    RtoD(rad: number) {
        return rad * 180 / Math.PI
    }
}

// データ


//PID
class PID {
    pitchPID: number[]

    lastTime = 0
    pitchAngle = 0 //ピッチ補正
    pitchE = [0, 0]
    pitchIntegral = 0

    constructor(pitchPID: number[]) {
        this.pitchPID = pitchPID
    }


    CalcPID(pitchGoal: number, rollGoal: number, nowTime: number) {
        let deltaTime = nowTime - this.lastTime
        this.lastTime = nowTime
        if (deltaTime == 0) return -1

        this.pitchE[1] = this.pitchE[0]

        const pitch = this.AccToDeg(input.acceleration(Dimension.Y), -input.acceleration(Dimension.Z))
        if (Math.abs(pitch) > 180) return -1

        this.pitchE[0] = pitchGoal - pitch

        this.pitchIntegral += (this.pitchE[0] + this.pitchE[1]) / 2 * deltaTime
        this.pitchE[0] = this.pitchE[0] * this.pitchPID[0] + this.pitchIntegral * this.pitchPID[1] + (this.pitchE[0] - this.pitchE[1]) * deltaTime * this.pitchPID[2]

        this.pitchAngle += this.pitchE[0]

        return 0
    }

    AccToDeg(x: number, y: number) {
        return Math.atan2(x, y) / Math.PI * 180
    }
}


// ベジェ

/**
     * Eight servos can be controlled at once
     * @param angle 8 arrays
     * @param msec 100 ~ 1000
     */
//% block="Set Angle $angle, msec %msec"
//% msec.min=100 msec.max=1000 msec.defl=500
//% advanced=true
function BezierServoMoving(angle1: number[], angle2: number[], msec: number) {
    const startTime = input.runningTime();

    let startangle = plenbit_full.servoAngle.slice()


    /*serial.writeNumbers(startangle)
    serial.writeLine("|")
    serial.writeNumbers(angle1)
    serial.writeLine("|")
    serial.writeNumbers(angle2)
    serial.writeLine("|")
    */


    // Angle = ベジェ曲線
    function Angle(time: number, ServoNum: number) {
        let t = time / msec

        let Angle0 = startangle[ServoNum]
        let Angle1 = angle1[ServoNum]
        let Angle2 = angle2[ServoNum]

        let B1 = (1 - t) * Angle0 + t * Angle1
        let B2 = (1 - t) * Angle1 + t * Angle2

        return (1 - t) * B1 + t * B2
    }

    let loop = true

    while (loop) {
        const deltaTime = input.runningTime() - startTime

        for (let i = 0; i < 18; i++) {
            plenbit_full.ServoControl(i, Angle(deltaTime, i), false)
            if (deltaTime >= msec) {
                loop = false
                break
            }
        }
    }

}
