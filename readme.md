
# Task Todo

Sistem ini mengatur alur task to do dengan mekanisme persetujuan (approval) berdasarkan tiga level role


## Cara Install

 - Clone Repository
 ``` bash
git clone https://github.com/username/nama-repo.git
 ```

- Buat Database Dengan nama 
``` bash
Task_Todo
```



### Backend

URL_API: [http://localhost:8080/](http://localhost:8080/)


- Masuk Repository

``` bash
cd nama-repo
 ``` 

 - Ubah .env
 ```bash
DB_HOST=localhost
DB_PORT=8889 --> isikan dengan port database mysql
DB_USER=root --> isikan dengan user database mysql
DB_PASSWORD=root --> isikan dengan password mysql
DB_NAME=Task_Todo
APP_PORT=8080
```

- Run Project

``` bash
go run main.go
 ```
 

 ### Frontend
 
``` bash
cd nama-repo
 ```

 - Double Klik index.html / buka index.html di browser

 last updated : 21/10/2025