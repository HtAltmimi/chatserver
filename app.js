
const app = require('express')()
const http = require('http').createServer(app)
const io = require('socket.io')(http);
const { json } = require('express');
const mysql = require('mysql');
const { Socket } = require('socket.io');

const port = process.env.PORT ||3001;
app.get('/', (req, res) => {
    res.send("chat Server is running. Yay!!")
});
var pool    =    mysql.createPool({
    connectionLimit : 1000,
    connectTimeout  : 60 * 60 * 1000,
    acquireTimeout  : 60 * 60 * 1000,
    timeout         : 60 * 60 * 1000,
    host            : '81.16.28.115',
    user            : 'u957169187_dna17',
    database        : 'u957169187_dna17',
    password        : '1fBI]*q9ruF^'
  });
 



io.use((socket, next) => {
    
    const method = socket.handshake.auth.method;
   console.log(method);
    if(method === 'register')
    {
    const userID = socket.handshake.query.userID;
    const firstname = socket.handshake.query.firstname;
    const lastname = socket.handshake.query.lastname;
        pool.query(`SELECT * FROM users WHERE userID='${userID}'`,(err,result)=>{
            if(err) throw err;
            if(result.length>0)
            {
            console.log('معرف محجوز');
            const err = new Error("معرف مستخدم");
            err.data = { content: "هذا المعرف مستخدم من قبل شخص اخر رجاء قم بادخال معرف اخر" };
            return next( err);
            }
            
                         else
                         {
                            const sql = `INSERT INTO users (userID, first_name, last_name) VALUES ('${userID}', '${firstname}', '${lastname}');`;
                            pool.query(sql,(err,result)=>{
                                if(err)throw err;
                                socket.userID = userID;
                                next()
                            });
                         }
                
                
            
});
}
else{
    const userID = socket.handshake.auth.userID;
    console.log(userID)
    pool.query(`SELECT * FROM users WHERE userID='${userID}'`,(err,result)=>{

        if(err)throw err;
        if(result.length>0)
        {
          
            
            socket.emit('login',JSON.stringify(result).replace(/]|[[]/g, ''));
            socket.userID = userID;
            next();
        }
        else{
            const err = new Error("بيانات غير صحيحة");
            err.data = { content: "الرجاء ادخال بيانات صحيحة" };
            return next( err);
        }
    });
}
});
    
  var connectedusersid = [];
  io.on('connection', socket => {
    socket.join(socket.userID);
    
    connectedusersid.push(socket.userID);
    io.emit('is_connected',({'userID':socket.userID,'status':true}));
    socket.on('users',()=>{
        var sql =`SELECT users.*,n.sender,n.isSend,n.message,n.date FROM users,(SELECT messages.* FROM messages,(SELECT max(date) AS date FROM (SELECT * FROM messages WHERE sender = "${socket.userID}" OR resiver= "${socket.userID}")m GROUP BY IF(m.sender="${socket.userID}",m.resiver,m.sender) )d WHERE messages.date = d.date)n WHERE (users.userID=n.sender AND n.resiver="${socket.userID}") OR (users.userID=n.resiver AND n.sender="${socket.userID}") ORDER BY n.date DESC;` 
        
        pool.query(sql,(err,result)=>{
        if(err)throw err;
        
        socket.emit('users',JSON.stringify(result));
    });
    });
    socket.on('image',(data)=>{
        console.log(data.length)
        pool.query(`UPDATE users SET image = '${data}' WHERE userID='${socket.userID}'`,(err,result)=>{
            if(err)throw err;
            socket.emit('image-add',data);
        });
    });
    socket.on('check_how_connected',(data)=>{
        var ids = JSON.parse(data);
        var map=[];
        for(var i=0 ; i<ids.length;i++){
            map.push({
                "userID":ids[i],
                "status":connectedusersid.includes(ids[i])
            });
        }
        console.log(JSON.stringify(map));
        socket.emit('check_how_connected',JSON.stringify(map));
    });
    socket.on('search-for-user' , (data)=>{
        
        pool.query(`SELECT * FROM users WHERE userID LIKE '${data}%';` , (err,result)=>{
            if(err) throw err;
            socket.emit('user-result',JSON.stringify(result));
        });
    });
    socket.on('getmessages',(data)=>{
        
        var sql = `SELECT * FROM messages WHERE (sender='${data.currentuser}' AND resiver='${data.selecteduser}')OR(sender='${data.selecteduser}' AND resiver='${data.currentuser}');`;
        pool.query(sql,(err,result)=>{
            socket.emit('getmessages',JSON.stringify(result));

        });
    });
    socket.on('is_connected' ,(data)=>{
        if(connectedusersid.includes(data.userID))
        {
            socket.emit('is_connected',({'userID':data.userID,'status':true}));
        }
        else{
            socket.emit('is_connected',({'userID':data.userID,'status':false}));
        }
    });

    socket.on('disconnect', () => {
        console.log('disconnect'+socket.userID);
        connectedusersid.pop(socket.userID);
        if(connectedusersid.includes(socket.userID)){
            // Then User Connected From Another Device
        }
        else{
            io.emit('is_connected',({'userID':socket.userID,'status':false}));
        }
        
    })

    socket.on('message', data => {

        pool.query(`SELECT * FROM messages WHERE (messages.sender="${socket.userID}" AND messages.resiver="${data.resiver}") OR (messages.sender="${data.resiver}" AND messages.resiver="${socket.userID}");`,(err1,result)=>{
            
            if(err1) throw err1;
            if(result.length>0)
            {
                sql =`INSERT INTO messages (sender,resiver,message,date) VALUES ('${data.sender}', '${data.resiver}', '${data.message}','${data.date}');`;
                pool.query(sql,(err,result)=>{
                    if(err)throw err;
                    pool.query(`SELECT * FROM messages WHERE messageID = '${result.insertId}'`,(err , messageResult)=>{
                        socket.emit('message_id',{index:data.index,message:JSON.stringify(messageResult).replace(/]|[[]/g, '')});
                        socket.broadcast.to(socket.userID).to(data.resiver).emit('message',JSON.stringify(messageResult).replace(/]|[[]/g, ''));
                    });
                });
            }else{
                sql2 =`INSERT INTO messages (sender,resiver,message,date) VALUES ('${data.sender}', '${data.resiver}', '${data.message}','${data.date}');`;
                pool.query(sql2,(err,result2)=>{
                    if(err)throw err;
                    pool.query(`SELECT * FROM messages WHERE messageID = '${result2.insertId}'`,(err , messageResult)=>{
                        socket.emit('message_id',{index:data.index,message:JSON.stringify(messageResult).replace(/]|[[]/g, '')});
                    });
                    pool.query(`SELECT users.* ,n.* FROM users,(SELECT * FROM messages WHERE messageID = '${result2.insertId}')n WHERE users.userID = IF(sender="${socket.userID}",n.sender,n.resiver);`,(err , newuser)=>{
                        
                        socket.broadcast.to(socket.userID).to(data.resiver).emit('new_user',JSON.stringify(newuser));
                    });
                });
                
            }
        });
       
        
    });
    socket.on('typing',(data)=>{
        io.to(data).emit('typing');
    });
    socket.on('stop-typing',(data)=>{
        io.to(data).emit('stop-typing');
    });
    socket.on('readmessage' , (data)=>{
        console.log("to",data.to,'id',data.ids);
        sql=`UPDATE messages SET isSend='received' WHERE FIND_IN_SET(messageID,REPLACE(REPLACE(REPLACE('${data.ids}',' ',''), '[', ''), ']', ''));`;
        pool.query(sql,(err,result)=>{
            if(err) throw err;
            socket.to(data.to).emit('readmessage',{'list':data.list,'ids':data.ids});
            
        });
    });
});

http.listen(port,()=>{
    console.log('server running on port ',port)
});
