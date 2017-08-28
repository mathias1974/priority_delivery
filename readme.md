# Emails processing system based on ETH/ETC contracts.

Install Haraka:
```
https://github.com/haraka/Haraka
```

```
cd /home/ubuntu/haraka
```

```
cd plugins
```

```
git clone https://github.com/mathias1974/priority_delivery.git
```

```
cd priority_delivery
```

Unlock geth account you want to use with the system. Eg: 

``` 
personal.unlockAccount(eth.accounts[5], "nicepass", 100000)
``` 


``` 
node create_host_contract.js --compiler=js --txFee=235290000000000 --accountId=3
``` 

Edit "priority_delivery.ini" and put there created "contract ID".

Copy the config file to the right place:

``` 
cp ./priority_delivery.ini ../../config/priority_delivery.ini
``` 

### Lock channel:

http://127.0.0.1:3627/lock?host=AA.com
