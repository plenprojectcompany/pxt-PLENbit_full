// tests go here; this will not be compiled when this package is used as a library

input.onButtonPressed(Button.A, function () {
    plenbit_full.PlayStdMotion(plenbit_full.StdMotions.ArmPataPata)
    plenbit_full.PlayWalkMotion(plenbit_full.WalkMotions.WalkForward)
    plenbit_full.PlayDanceMotion(plenbit_full.DanceMotions.DanceFStep)
})
function OriginalMotion() {
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
input.onButtonPressed(Button.AB, function () {
    basic.showIcon(IconNames.Happy)
    plenbit_full.RecodingOriginalMotion(0)
    OriginalMotion()
    plenbit_full.StopRecodingOriginalMotion()
    basic.showIcon(IconNames.Heart)
})
input.onButtonPressed(Button.B, function () {
    plenbit_full.PlayOriginalMotion(0)
})
plenbit_full.AutoPowerOff(30)
plenbit_full.Power(true)
plenbit_full.LedEye(100)
plenbit_full.ServoInitialSet()
