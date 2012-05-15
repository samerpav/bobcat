from pprint import pprint

from twisted.web.server import Site
from twisted.web import server
from twisted.web.resource import Resource
from twisted.internet import reactor, defer, threads
from twisted.web.static import File

import cPickle
import time

import socket

def wait(seconds, result=None):
    d = defer.Deferred()
    reactor.callLater(seconds, d.callback, result)
    return d

class Load(Resource):

    def final(self, message, request): 
        request.finish()

    #@defer.inlineCallbacks

    def crap(self, request, name, num):
        x = ''
        pprint(str(num))
        for n in range(num):
            with open('c:\\' + name + '_' + str(n) + '.vbo', 'rb') as f:
                x = cPickle.load(f)
                request.write(x)
                pprint("sending cloud #" + str(n))
                #yield wait(0.0)
        
        
    def render_GET(self, request):
        isLeaf = True
        cloudName = request.received_headers['cloudName']

        # check that file cloudName exists
        # nyi

        # find out how many vbo's there are
        with open('c:\\' + cloudName) as f:
            numVBO = int(f.readline())

        if numVBO > 0:
            # get just filename 
            fileName = cloudName.split('.')[0]

            #self.crap(request, fileName, numVBO)
            
            d = threads.deferToThread(self.crap, request, fileName, numVBO)
            d.addCallback(lambda _: request.finish())

            return server.NOT_DONE_YET
                    
        #x += cPickle.load(f)
        #print(type(x))

        #equest.finish()
        #return server.NOT_DONE_YET
        #return x

        #return -1;

class UploadVBO(Resource):
    def render_GET(self, request):
        return ''

    def render_POST(self, request):
        cloudName = request.received_headers['x-cloudName']
        cloudSeq = request.received_headers['x-cloudSequence']
        cloudArrayByteLength = request.received_headers['X-cloudArrayByteLength'] 
        cloudNumPoints = request.received_headers['X-cloudNumPoints'] 
        pprint(cloudName + ' ' + cloudSeq + ' ' + cloudArrayByteLength + ' ' + cloudNumPoints)

        #pprint(request.__dict__)
        #pprint(request.content.read()) 

        with open('c:\\' + cloudName + '_' + cloudSeq + '.vbo', 'wb') as f:
            d = request.content.read()
            cPickle.dump(d, f, cPickle.HIGHEST_PROTOCOL)  

        return ''

## this completes the upload process by writing .pointcloud file
## right now there's on TotalSequence but more will come
class CreatePointCloudFile(Resource):
    def render_GET(self, request):
        return ''

    def render_POST(self, request):
        cloudName = request.received_headers['x-cloudName']
        cloudTotalSeq = request.received_headers['X-cloudTotalSequence']
        pprint("writing " + cloudName + ".pointcloud, # of VBOs = " + cloudTotalSeq)

        # write .pointcloud file
        with open('c:\\' + cloudName + '.pointcloud', 'w') as f:
            f.write(str(cloudTotalSeq))

        return 1

class QueryPickPoint(Resource):
    def render_GET(self, request):
       isLeaf = True
       RayOriginX = request.received_headers['rayoriginx']
       RayOriginY = request.received_headers['rayoriginy']
       RayOriginZ = request.received_headers['rayoriginz']
       RayDirX = request.received_headers['raydirx']
       RayDirY = request.received_headers['raydiry']
       RayDirZ = request.received_headers['raydirz']

       HOST = '127.0.0.1'
       PORT = 9000 
       s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
       s.connect((HOST, PORT))
       #s.sendall('1,0.849,-2.379,0.445,0.019,0.569,-0.822')
       
       strQuery = '1,%s,%s,%s,%s,%s,%s' % (RayOriginX,RayOriginY,RayOriginZ,RayDirX,RayDirY,RayDirZ)
       pprint(strQuery)
       s.sendall(strQuery)
       
       data = s.recv(1024)
       s.close()
       #request.write(data)

       pprint('Received' + repr(data))

       #request.finish()
       

root = Resource()
root.putChild('', File("C:\\Users\\mer\\.ssh\\bobcat"))
root.putChild('upload', UploadVBO())
root.putChild('load', Load())
root.putChild('findpickpoint', QueryPickPoint())
root.putChild('finalize', CreatePointCloudFile())

factory = Site(root)
reactor.listenTCP(8080, factory)
reactor.run()
