# erss-project-ch450-pl204

UPS Team

# Feature

1.	Priority: We can make sure that our order follows the first come first service by using the job queue. The customer can be fair for anyone, and it will not cause starving issue.
2.	Edit: We can make sure that customers can change their address before the package delivered.



## Database setup

We use postgres to set up our database.

## World simulation
Will take about 5 mins:
`sudo docker-compose build`

`sudo docker-compose up`



To run the world simulator with a different flakiness, go to "docker-compose.yml" file, change the command from bash -c "./wait-for-it.sh mydb:5432 --strict -- ./server 12345 23456 0" into bash -c "./wait-for-it.sh mydb:5432 --strict -- ./server 12345 23456 <flakiness_num>". Then do as last paragragh said.

Note flakiness ranges from 0 to 99. When flakiness equels 0, it mean the world will not deliverately drop any request it receives. As flakiness grows, the possibility that the world randomly drops requests will be larger. You can view this behavior as in real life "error in communication". That's also why we are having ack number for each requests.



