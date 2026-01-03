import os
import requests
import base64

# INSTRUZIONI:
# 1. Sostituisci i valori qui sotto con le tue credenziali Twilio reali.
# 2. Esegui lo script con: python test_twilio.py

TWILIO_ACCOUNT_SID = "AC..."  # Inserisci il tuo Account SID
TWILIO_AUTH_TOKEN = "..."     # Inserisci il tuo Auth Token
TWILIO_FROM = "..."           # Inserisci il tuo numero Twilio (es. +1234567890)
TO_PHONE = "+393898505354"    # Il numero che ha dato errore

def test_send_sms():
    if TWILIO_ACCOUNT_SID == "AC..." or TWILIO_AUTH_TOKEN == "...":
        print("ERRORE: Devi inserire le tue credenziali Twilio nello script prima di eseguirlo.")
        return

    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}/Messages.json"
    
    # Autenticazione Basic Auth
    auth_str = f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}"
    auth_bytes = auth_str.encode('ascii')
    auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
    
    headers = {
        "Authorization": f"Basic {auth_b64}",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    data = {
        "To": TO_PHONE,
        "From": TWILIO_FROM,
        "Body": "Test Badiani: verifica configurazione Twilio OK."
    }
    
    print(f"Tentativo di invio SMS a {TO_PHONE} da {TWILIO_FROM}...")
    
    try:
        response = requests.post(url, headers=headers, data=data)
        
        print(f"Status Code: {response.status_code}")
        
        if response.ok:
            print("SUCCESSO! SMS inviato correttamente.")
            print("Risposta Twilio:", response.json())
        else:
            print("FALLITO. Errore da Twilio:")
            print(response.text)
            print("\nSUGGERIMENTI:")
            if response.status_code == 401:
                print("- Controlla che SID e Token siano corretti.")
            elif "21408" in response.text:
                print("- Abilita i permessi geografici per l'Italia nella console Twilio.")
            elif "21608" in response.text:
                print("- Questo è un account di prova. Devi verificare il numero di destinazione su Twilio.")
            elif "21211" in response.text:
                print("- Numero di telefono non valido.")
                
    except Exception as e:
        print(f"Errore di connessione: {e}")

if __name__ == "__main__":
    test_send_sms()
