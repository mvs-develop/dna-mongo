# Docker启动开发环境的Mongodb

docker run -d  -p 27017:27017 --name mongodb \
-e MONGO_INITDB_ROOT_USERNAME=mongo \
-e MONGO_INITDB_ROOT_PASSWORD=mongo \
mongo

docker exec -it mongodb bash

mongo 127.0.0.1:27017 -u 'mongo' -p 'mongo' --authenticationDatabase 'admin'

# Mongodb本地可视化工具
https://robomongo.org/download
