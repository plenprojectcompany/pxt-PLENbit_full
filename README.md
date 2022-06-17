# pxt-plenbit_full-blocks

## PLEN:bit full

PLEN:bit full is a full-sized robot of PLEN:bit, which is a small humanoid robot with movable arms and legs. Anyone can easily use PLEN:bit series through programing and onboard sensors.

Please refer to this page about PLEN:bit series.
https://plen.jp/plenbit_full/#manual

https://makecode.microbit.org/pkg/plenprojectcompany/pxt-plenbit_full

## Basic usage

```blocks
//Play WalkForward motion when button A pressed
//There are many other motions.
input.onButtonPressed(Button.A, function () {
    plenbit_full.stdMotion(plenbit_full.StdMotions.WalkForward)
})
```

## Examples:

### PLEN:bit Basic

```blocks
plenbit_full.servoInitialSet()
basic.showIcon(IconNames.Happy)

basic.forever(function () {
    plenbit_full.eyeLed(plenbit_full.LedOnOff.On)
    basic.pause(100)
    plenbit_full.eyeLed(plenbit_full.LedOnOff.Off)
    basic.pause(100)
})

input.onButtonPressed(Button.A, function () {
    plenbit_full.stdMotion(plenbit_full.StdMotions.WalkForward)
})
input.onButtonPressed(Button.B, function () {
    plenbit_full.stdMotion(plenbit_full.StdMotions.ArmPataPata)
})
input.onButtonPressed(Button.AB, function () {
    plenbit_full.soccerMotion(plenbit_full.SocMotions.RKick)
})
```

### Distance sensor Basic

```blocks
basic.forever(function () {
    if (plenbit_full.checkDistane(plenbit_full.LedLr.BButtonSide, 600)) {
        basic.showIcon(IconNames.Happy)
        plenbit_full.stdMotion(plenbit_full.StdMotions.ArmPataPata)
    } else {
        basic.showIcon(IconNames.Sad)
    }
})
```
### Sound sensor Basic

```blocks
let mic = plenbit_full.initMic(plenbit_full.LedLr.AButtonSide)
basic.showIcon(IconNames.Sad)
basic.forever(function () {
    if (plenbit_full.checkMic(plenbit_full.LedLr.AButtonSide, 150, mic)) {
        basic.showIcon(IconNames.Happy)
        plenbit_full.stdMotion(plenbit_full.StdMotions.ArmPataPata)
        basic.showIcon(IconNames.Sad)
    }
})
```

### Walking

```blocks
// Type A
input.onButtonPressed(Button.A, function () {
    plenbit_full.stdMotion(plenbit_full.StdMotions.WalkForward)
    plenbit_full.stdMotion(plenbit_full.StdMotions.WalkForward)
    plenbit_full.stdMotion(plenbit_full.StdMotions.WalkForward)
})
// Type B
input.onButtonPressed(Button.B, function () {
    plenbit_full.walk(plenbit_full.WalkMode.Move)
    plenbit_full.walk(plenbit_full.WalkMode.Move)
    plenbit_full.walk(plenbit_full.WalkMode.Move)
    plenbit_full.walk(plenbit_full.WalkMode.Stop)
})
```

### Fall over

```blocks
basic.showIcon(IconNames.Happy)
basic.forever(function () {
    if (input.acceleration(Dimension.Z) < -512) {
        basic.showIcon(IconNames.Sad)
        plenbit_full.stdMotion(plenbit_full.StdMotions.ArmPataPata)
    } else {
        basic.showIcon(IconNames.Happy)
    }
})
```

### Dodge the wall

```blocks
basic.forever(function () {
    if (plenbit_full.checkDistane(plenbit_full.LedLr.BButtonSide, 600)) {
        basic.showIcon(IconNames.Sad)
        for (let index = 0; index < 3; index++) {
            plenbit_full.stdMotion(plenbit_full.StdMotions.WalkRTurn)
        }
        basic.showIcon(IconNames.Happy)
    } else {
        plenbit_full.stdMotion(plenbit_full.StdMotions.WalkForward)
    }
})
```

### Dodge the wall 2

```blocks
basic.forever(function () {
    if (plenbit_full.checkDistane(plenbit_full.LedLr.BButtonSide, 600)) {
        plenbit_full.walk(plenbit_full.WalkMode.Stop)
        basic.showIcon(IconNames.Sad)
        for (let index = 0; index < 3; index++) {
            plenbit_full.stdMotion(plenbit_full.StdMotions.WalkRTurn)
        }
        basic.showIcon(IconNames.Happy)
    } else {
        plenbit_full.walk(plenbit_full.WalkMode.Move)
    }
})
```

### GO NORTH

```blocks
let direction = 0
basic.forever(function () {
    direction = plenbit_full.direction()
    if (direction <= 20 || direction >= 340) {
        basic.showArrow(ArrowNames.North)
        plenbit_full.stdMotion(plenbit_full.StdMotions.WalkForward)
    } else if (direction > 20 && direction <= 180) {
        basic.showArrow(ArrowNames.East)
        plenbit_full.stdMotion(plenbit_full.StdMotions.WalkLTurn)
    } else if (direction > 180 && direction < 340) {
        basic.showArrow(ArrowNames.West)
        plenbit_full.stdMotion(plenbit_full.StdMotions.WalkRTurn)
    }
})
```
### Let's make a motion!

```blocks
plenbit_full.servoInitialSet()
basic.showIcon(IconNames.Happy)

input.onButtonPressed(Button.A, function () {
    R_Punch()
})
function R_Punch () {
    plenbit_full.setAngle([0, 0, 0, 0, -900, 0, 0, 0], 300)
    plenbit_full.setAngle([0, 0, 0, 0, 0, 0, 0, 0], 300)
}
input.onButtonPressed(Button.B, function () {
    L_Punch()
})
function L_Punch () {
    plenbit_full.setAngle([900, 0, 0, 0, 0, 0, 0, 0], 300)
    plenbit_full.setAngle([0, 0, 0, 0, 0, 0, 0, 0], 300)
}
```

### Remote control

Requires two micro:bits

```blocks
radio.setGroup(0)
basic.showIcon(IconNames.Happy)

input.onButtonPressed(Button.A, function () {
    radio.sendString("A")
})
input.onButtonPressed(Button.AB, function () {
    radio.sendString("C")
})
radio.onReceivedString(function (receivedString) {
    if (receivedString == "A") {
        plenbit_full.stdMotion(plenbit_full.StdMotions.WalkForward)
    } else if (receivedString == "B") {
        plenbit_full.stdMotion(plenbit_full.StdMotions.WalkRTurn)
    } else if (receivedString == "C") {
        plenbit_full.stdMotion(plenbit_full.StdMotions.HighFive)
    }
})
input.onButtonPressed(Button.B, function () {
    radio.sendString("B")
})
```

### Distance to cm

```blocks
let dis = 0
let Adjust = 20
basic.showIcon(IconNames.SmallDiamond)
basic.forever(function () {
    dis = plenbit_full.sensorLR(plenbit_full.LedLr.BButtonSide)
    dis = Math.map(dis, 0, 1023, 0, 330 - Adjust)
    dis = Math.map(dis, 60, 220, 50, 4)
    serial.writeValue("CM", dis)
    if (dis <= 6) {
        plenbit_full.stdMotion(plenbit_full.StdMotions.ArmPataPata)
    }
    basic.pause(50)
})
```

### Servo Control

```blocks
basic.showIcon(IconNames.Happy)
plenbit_full.servoInitialSet()
input.onButtonPressed(Button.A, function () {
    plenbit_full.servoWrite(11, 34)
})
```

### Sensor watching

```blocks
basic.forever(function () {
    serial.writeValue("mic", plenbit_full.sensorLR(plenbit_full.LedLr.AButtonSide))
    serial.writeValue("dis", plenbit_full.sensorLR(plenbit_full.LedLr.BButtonSide))
})
```

### Servo Adjust

```blocks
/**
 * How to use
 * 1.Push A to start correction
 * 2.Push A or B to move each servo
 * 3.Push A+B to switch to next servo
 * 4.Loop
 * 5.Ends when smile is displayed
 * 6.Reset, then Push B to walk
 * If PLEN does not fall over, setting is complete
 */
let loop = false
let servoNum = 0
let adjNum = 0
plenbit_full.servoInitialSet()
basic.showIcon(IconNames.Happy)
basic.forever(function () {
    if (input.buttonIsPressed(Button.A)) {
        servoAdjust()
    } else if (input.buttonIsPressed(Button.B)) {
        plenbit_full.stdMotion(plenbit_full.StdMotions.WalkForward)
    } else if (input.buttonIsPressed(Button.AB)) {
        plenbit_full.resetPosition()
        basic.pause(1000)
    }
})
function servoAdjust () {
    adjNum = 0
    servoNum = 0
    basic.showNumber(servoNum)
    loop = true
    while (loop) {
        if (input.buttonIsPressed(Button.AB)) {
            plenbit_full.savePositon(servoNum, adjNum)
            servoNum += 1
            adjNum = 0
            basic.showNumber(servoNum)
        } else if (input.buttonIsPressed(Button.A)) {
            adjNum += 1
            adjNum = plenbit_full.servoAdjust(servoNum, adjNum)
        } else if (input.buttonIsPressed(Button.B)) {
            adjNum += -1
            adjNum = plenbit_full.servoAdjust(servoNum, adjNum)
        } else if (servoNum > 7) {
            basic.showIcon(IconNames.Happy)
            basic.pause(2000)
            loop = false
        }
    }
}
```


## Other guides

Programming guide here
https://plen.jp/wp/plenbit/

## License

MIT

## Supported targets

* for PXT/microbit
```package
plenbit_full=github:plenprojectcompany/pxt-plenbit_full
```
