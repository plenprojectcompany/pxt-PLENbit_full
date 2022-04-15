# pxt-plenbit_full-blocks

## PLEN:bit full

PLEN:bit full is a full-size robot of PLEN:bit, which is a small humanoid robot with movable arms and legs. Anyone can easily use PLEN:bit series through programing and onboard sensors.

Please refer to this page about PLEN:bit series.
https://plen.jp/plenbit/#manual

https://makecode.microbit.org/pkg/plenprojectcompany/pxt-plenbit_full

## Basic usage

```blocks
//Play WalkForward motion when button A pressed
//There are many other motions.
input.onButtonPressed(Button.A, function () {
    plenbit_full.PlayWalkMotion(plenbit_full.WalkMotions.WalkForward)
})
```

## Examples:

### PLEN:bit Basic

```blocks
plenbit_full.ServoInitialSet()
basic.showIcon(IconNames.Happy)

basic.forever(function () {
    plenbit_full.LedEye(100)
    basic.pause(100)
    plenbit_full.LedEye(0)
    basic.pause(100)
})

input.onButtonPressed(Button.A, function () {
    plenbit_full.PlayWalkMotion(plenbit_full.WalkMotions.WalkForward)
})
input.onButtonPressed(Button.B, function () {
    plenbit_full.PlayStdMotion(plenbit_full.StdMotions.ArmPataPata)
})
input.onButtonPressed(Button.AB, function () {
    plenbit_full.PlayDanceMotion(plenbit_full.DanceMotions.DanceUpDown)
})
```

### Walking

```blocks
// Type A
input.onButtonPressed(Button.A, function () {
    plenbit_full.PlayWalkMotion(plenbit_full.WalkMotions.WalkForward)
    plenbit_full.PlayWalkMotion(plenbit_full.WalkMotions.WalkForward)
    plenbit_full.PlayWalkMotion(plenbit_full.WalkMotions.WalkForward)
})
// Type B
input.onButtonPressed(Button.B, function () {
    for (let i = 0; i < 3; i++) {
        plenbit_full.PlayWalkMotion(plenbit_full.WalkMotions.WalkForward)
    }
})
```

### Fall over

```blocks
basic.showIcon(IconNames.Happy)
basic.forever(function () {
    if (input.acceleration(Dimension.Z) < -512) {
        basic.showIcon(IconNames.Sad)
        plenbit_full.PlayStdMotion(plenbit_full.StdMotions.ArmPataPata)
    } else {
        basic.showIcon(IconNames.Happy)
    }
})
```

### Let's make a motion!

```blocks
for (let index = 0; index < 2; index++) {
    plenbit_full.SetLArm(90, 0, 0)
    plenbit_full.SetRArm(-90, 0, 0)
    plenbit_full.ServoMove(500)
    plenbit_full.SetLArm(-90, 0, 0)
    plenbit_full.SetRArm(90, 0, 0)
    plenbit_full.ServoMove(500)
}
plenbit_full.ServoMoveInit(500)
```

### Original Motion

```blocks
function ArmSwingsTwice() {
    for (let index = 0; index < 2; index++) {
        plenbit_full.SetLArm(90, 0, 0)
        plenbit_full.SetRArm(-90, 0, 0)
        plenbit_full.ServoMove(500)
        plenbit_full.SetLArm(-90, 0, 0)
        plenbit_full.SetRArm(90, 0, 0)
        plenbit_full.ServoMove(500)
    }
    plenbit_full.ServoMoveInit(500)
}
input.onButtonPressed(Button.A, function () {
    basic.showIcon(IconNames.Happy)
    plenbit_full.RecodingOriginalMotion(0)
    ArmSwingsTwice()
    plenbit_full.StopRecodingOriginalMotion()
    basic.showIcon(IconNames.Heart)
})
input.onButtonPressed(Button.B, function () {
    plenbit_full.PlayOriginalMotion(0)
})

```

### Servo Control

```blocks
basic.showIcon(IconNames.Happy)
plenbit_full.ServoInitialSet()
input.onButtonPressed(Button.A, function () {
    plenbit_full.ServoControl(11, 34)
})
```

### Servo Adjust

```blocks
/**
 * How to use
 * 
 * 1.Push A to start correction
 * 
 * 2.Push A or B to move each servo
 * 
 * 3.Push A+B to switch to next servo
 * 
 * 4.Loop
 * 
 * 5.Ends when smile is displayed
 * 
 * 6.Reset, then Push B to walk
 * 
 * If PLEN does not fall over, setting is complete
 */
function servoAdjust () {
    adjNum = 0
    servoNum = 0
    basic.showNumber(servoNum)
    loop = true
    while (loop) {
        if (input.buttonIsPressed(Button.AB)) {
            plenbit_full.SaveInitPosition()
            servoNum += 1
            adjNum = 0
            basic.showNumber(servoNum)
        } else if (input.buttonIsPressed(Button.A)) {
            plenbit_full.servoInitArray[servoNum] ++
plenbit_full.ServoInitialSet()
        } else if (input.buttonIsPressed(Button.B)) {
            plenbit_full.servoInitArray[servoNum]--
plenbit_full.ServoInitialSet()
        } else if (servoNum > 17) {
            basic.showIcon(IconNames.Happy)
            basic.pause(2000)
            loop = false
        }
    }
}
let loop = false
let adjNum = 0
let servoNum = 0
plenbit_full.ServoInitialSet()
basic.showIcon(IconNames.Happy)
basic.forever(function () {
    if (input.buttonIsPressed(Button.A)) {
        servoAdjust()
    } else if (input.buttonIsPressed(Button.B)) {
        plenbit_full.PlayWalkMotion(plenbit_full.WalkMotions.WalkForward)
    } else if (input.buttonIsPressed(Button.AB)) {
        plenbit_full.ResetInitPosition()
        basic.pause(1000)
    }
})
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
