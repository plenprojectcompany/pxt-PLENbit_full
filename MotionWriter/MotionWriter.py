import glob
import serial
import sys
import serial.tools.list_ports
import re
import datetime
import time

# フルサイズPLENモーション書き込みプログラム
# バージョン(max 65536)
Version = 0

# デバッグモード
Debug = False

# モーションデータの相対パス
MotionDataPath = 'MotionData/'

try:
    # シリアルポートの検索
    def serial_search(vid, pid):
        ports = list(serial.tools.list_ports.comports())
        for p in ports:
            if p.vid == vid and p.pid == pid:
                return p.device
        return None

    # micro:bitのシリアルポートを検索する
    SerialPort = serial_search(0x0d28, 0x0204)
    if SerialPort is None:
        print('書き込み用micro:bitの接続を待機しています...')
        while SerialPort is None:
            SerialPort = serial_search(0x0d28, 0x0204)
        time.sleep(1)

    # シリアルポートを開く
    ser = serial.Serial(SerialPort, 115200, timeout=0.1)

    sendId = -1

    def Send(value):
        global sendId
        if Debug:
            print(value)
        sendId += 1
        value = str(sendId) + '|' + str(value)

        while True:
            SerialSend(value)
            feedback = ser.readline().strip().decode('UTF-8')
            if feedback == 'S':
                if Debug:
                    print('Success')
                break
            else:
                failCheck = re.match(r'^Fail\[([0-9]+)\]([0-9]+)$',feedback)

                if failCheck:
                    if failCheck.group(1).isdecimal() and failCheck.group(2).isdecimal():
                        checksum = 0
                        for i in failCheck.group(1):
                            checksum += int(i)
                        if int(failCheck.group(2)) == checksum and int(failCheck.group(1)) > sendId:
                            if Debug:
                                print('Success')
                            break

                if Debug:
                    print('Fail_' + str(sendId) + '_' + feedback)

    def SerialSend(value):
        value16 = value.encode('utf-8')
        ser.write(('[' + value + ']' + str(sum(bytearray(value16))) + '\n').encode('utf-8'))

    def SendByteArray(array):
        if Debug:
            print(array)
        for data in array:
            Send(data)

    # モーション書き込み可能か確認
    print('書き込みプログラムの起動を待機しています...')

    # 書き込み開始
    Send('Start')

    print('書き込み開始')

    # モーション書き込み開始
    Send('MotionWrite')

    flameArray = [0] * 256
    files = glob.glob(MotionDataPath + '*.txt')
    for file in files:
        motionNumber = int(re.match(r'.*\\([0-9])*\_.*\.txt$', file).group(1))
        print('> モーション：' + str(motionNumber))

        f = open(file, 'r')
        datalist = f.readlines()

        count = 0
        flame = 0
        motionDataArray = []
        for data in datalist:
            motionData = data.replace('\n', '')
            if count % 2 == 0:
                flame = int(count / 2)
                motionDataArray.extend([motionNumber, flame])
                motionTime = int(motionData)
                motionDataArray.extend([int(motionTime >> 8), int(motionTime & 0xFF)])
            else:
                motionDataArray.extend([int(s) for s in motionData.split(',')])
            count += 1
        f.close()

        flameArray[motionNumber] = flame + 1

        # モーションデータ送信
        SendByteArray(motionDataArray)

    Send('Complete')

    # フレーム情報送信
    Send('FlameWrite')
    print('> フレーム情報')
    SendByteArray(flameArray)
    Send('Complete')

    # バージョン情報送信
    infomation = \
        'plen:xxx motion data,' + \
        'ver:' + str(Version) + ',' + \
        'time:' + datetime.datetime.now().strftime('%Y/%m/%d %H:%M:%S')

    infomationbBytearray = bytearray(infomation.encode('utf-8'))
    while len(infomationbBytearray) < 256:
        infomationbBytearray.append(0)

    del infomationbBytearray[256:]

    Send('VerWrite')
    print('> バージョン情報')
    SendByteArray(infomationbBytearray)
    Send('Complete')

    # 完了
    Send('AllComplete')

    # ポートを閉じる
    ser.close()

    print('\nモーションデータの転送が完了しました！')
except BaseException as e:
    print('\nエラーが発生しました\nもう一度書き込みを行ってください')
    print(e)


