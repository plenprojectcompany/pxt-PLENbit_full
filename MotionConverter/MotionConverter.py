# MotionConverter
# PLEN.Dのモーションデータ->フルサイズPLENのモーションデータ変換

import glob
import json
import os
import re

# モーションデータの相対パス
MotionDataPath = "MotionData/"

# 保存先の相対パス
SaveDataPath = "ConvertedData/"

# サーボ反転
servoReverse = [
    True,
    True,
    False,
    True,
    False,
    True,
    True,
    False,
    False,
    False,
    False,
    True,
    False,
    True,
    False,
    False,
    True,
    True,
]


files = glob.glob(MotionDataPath + "*.json")

print("開始")

for filePath in files:
    data = open(filePath, "r")
    jsonData = json.load(data)

    fileName = os.path.split(filePath)[1]
    fileNameCheck = re.match(r"^([0-9A-Z]+)_(.*)\.json$", fileName)

    if fileNameCheck:
        motionNum = int(fileNameCheck.group(1), 16)
        motionName = fileNameCheck.group(2)

        convertedData = ""

        for x in range(jsonData["@frame_length"]):
            motionData = jsonData["frames"][x]
            motionTime = motionData["transition_time_ms"]
            motionAngle = []

            for y in range(len(motionData["outputs"])):
                angle = int(motionData["outputs"][y]["value"] / 10)
                if servoReverse[y] == False:
                    angle *= -1
                motionAngle.append(str(angle))
            convertedData += str(motionTime) + "\n" + ",".join(motionAngle) + "\n"
        f = open(SaveDataPath + str(motionNum) + "_" + motionName + ".txt", "w")
        f.write(convertedData)
        f.close()
print("完了")
