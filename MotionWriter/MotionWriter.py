import glob
import serial
import serial.tools.list_ports
import re
import datetime
import time
import json

# フルサイズPLENモーション書き込みプログラム
# バージョン(max 65536)
Version = "0.0.0"

# デバッグモード
Debug = False

# モーションデータの相対パス
MotionDataPath = "MotionData/"

sendId = -1


def Send(value):
    global sendId
    if Debug:
        print(value)
    if sendId == -1:
        sendId += 1
        Send('Start')
        # 書き込み開始
        print("書き込み開始")
    sendId += 1
    value = str(sendId) + "|" + value

    while True:
        SerialSend(value)
        feedback = ser.readline().strip().decode("UTF-8")
        if feedback == "S":
            if Debug:
                print("Success")
            break
        elif feedback == "E":
            if Debug:
                print("Error")
            raise Exception(
                "書き込み途中で中断されました"
            )
            break
        else:
            failCheck = re.match(r"^Fail\[([0-9]+)\]([0-9]+)$", feedback)

            if failCheck:
                if failCheck.group(1).isdecimal() and failCheck.group(2).isdecimal():
                    checksum = 0
                    for i in failCheck.group(1):
                        checksum += int(i)
                    if (
                        int(failCheck.group(2)) == checksum
                        and int(failCheck.group(1)) > sendId
                    ):
                        if Debug:
                            print("Success")
                        break
            if Debug:
                print("Fail_" + str(sendId) + "_" + feedback)


def SerialSend(value):
    value16 = value.encode("utf-8")
    ser.write(("[" + value + "]" + str(sum(bytearray(value16))) + "\n").encode("utf-8"))

def natSort(value):
    numbers = re.compile(r'(\d+)')
    parts = numbers.split(value)
    parts[1::2] = map(int, parts[1::2])
    return parts


try:
    usedMemory = 0
    maxMemory = 65536

    def SendByteArray(array):
        global usedMemory
        if Debug:
            print(array)
        usedMemory += len(array)
        if usedMemory > maxMemory:
            raise Exception("EEPROMの容量が不足しています．不要なモーションを削除してください")
        for data in array:
            Send(str(data))

    # シリアルポートの検索
    def serial_search(vid, pid):
        ports = list(serial.tools.list_ports.comports())
        for p in ports:
            if p.vid == vid and p.pid == pid:
                return p.device
        return None

    # micro:bitのシリアルポートを検索する
    SerialPort = serial_search(0x0D28, 0x0204)
    if SerialPort is None:
        print("書き込み用micro:bitの接続を待機しています...")
        while SerialPort is None:
            SerialPort = serial_search(0x0D28, 0x0204)
        time.sleep(1)

    # シリアルポートを開く
    ser = serial.Serial(SerialPort, 115200, timeout=0.1)

    # モーション書き込み可能か確認
    print("書き込みプログラムの起動を待機しています...")

    # モーション書き込み開始
    Send("MotionWrite")

    flameArray = [0] * 256
    files = sorted(glob.glob(MotionDataPath + "*.txt"), key=natSort)
    sentMotionNumber = -1
    for filePath in files:
        motionNumberCheck = re.match(r"^.*\\([0-9]*)\_.*\.txt$", filePath)
        if motionNumberCheck is None:
            raise Exception(
                "モーションファイル「"
                + filePath
                + "」 のファイル名が "
                + "[モーション番号]-[モーション名].txt になっていません"
            )
        motionNumber = int(motionNumberCheck.group(1))
        if motionNumber <= sentMotionNumber:
            raise Exception(
                "モーション" + str(motionNumber) + "のファイルが2つ以上あります. " + "不要なモーションを削除してください"
            )
        if motionNumber >= 256:
            raise Exception(
                "最大書き込みモーションは255です" + "不要なモーションを削除してください"
            )
        sentMotionNumber = motionNumber
        print("> モーション：" + str(motionNumber))

        f = open(filePath, "r")
        datalist = f.readlines()

        count = 0
        flame = 0
        motionDataArray = []
        for data in datalist:
            motionData = data.replace("\n", "")
            if motionData:
                if count % 2 == 0:
                    flame = int(count / 2)
                    motionDataArray.extend([motionNumber, flame])
                    motionTime = int(motionData)
                    motionDataArray.extend(
                        [int(motionTime >> 8), int(motionTime & 0xFF)]
                    )
                else:
                    motionAngles = [int(s) for s in motionData.split(",")]
                    if len(motionAngles) != 18:
                        raise Exception(
                            "モーションファイル「"
                            + filePath
                            + "」 の"
                            + str(count + 1)
                            + "行目に誤りがあります. "
                        )
                    motionDataArray.extend(motionAngles)
                count += 1
        f.close()

        if count % 2 != 0:
            raise Exception(
                "モーションファイル「" + filePath + "」 の" + str(count + 1) + "行目に誤りがあります. "
            )

        flameArray[motionNumber] = flame + 1

        # モーションデータ送信
        SendByteArray(motionDataArray)

    Send("Complete")

    # フレーム情報送信
    Send("FlameWrite")
    print("> フレーム情報")
    SendByteArray(flameArray)
    Send("Complete")

    # バージョン情報送信
    dtNow = datetime.datetime.now()
    infomation = {
        'detail':'PLEN:xxx motion data',
        'ver':Version,
        'time':datetime.datetime.now().strftime("%Y/%m/%d %H:%M:%S")
        }

    infomationbBytearray = bytearray(json.dumps(infomation).encode("utf-8"))
    while len(infomationbBytearray) < 256:
        infomationbBytearray.append(0)
    del infomationbBytearray[256:]

    Send("VerWrite")
    print("> バージョン情報")
    SendByteArray(infomationbBytearray)
    Send("Complete")

    # 完了
    Send("AllComplete")

    # ポートを閉じる
    ser.close()

    print("\nモーションデータの転送が完了しました！")
    if Debug:
        print(
            "EEPROM空き容量："
            + str(maxMemory - usedMemory)
            + "バイト"
            + " （"
            + str(int((maxMemory - usedMemory) / maxMemory * 100))
            + "% free）"
        )
except ValueError as e:
    print("\nエラーが発生しました\nもう一度書き込みを行ってください\n")
    print("[Error] モーションファイルの形式を確認してください. " + str(e))
    Send("Error")
except BaseException as e:
    print("\nエラーが発生しました\nもう一度書き込みを行ってください\n")
    print("[Error] " + str(e))
    Send("Error")
