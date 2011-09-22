from pprint import pprint

from twisted.web.server import Site
from twisted.web.resource import Resource
from twisted.internet import reactor
from twisted.web.static import File

import cgi
import cPickle

class Load(Resource):
    def render_GET(self, request):
        cloudName = request.received_headers['cloudName']

        # check that file cloudName exists
        # NYI

        # find out how many vbo's there are
        with open('c:\\' + cloudName) as f:
            numVBO = int(f.readline())

        if numVBO > 0:
            # get just filename 
            fileName = cloudName.split('.')[0]

            x = ''
            for n in range(numVBO):
                with open('c:\\' + fileName + '_' + str(n) + '.vbo', 'rb') as f:
                     x += cPickle.load(f)
                    #print(type(x))

            return x

        return -1;

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

root = Resource()
root.putChild('', File("C:\\Users\\sam\\.ssh\\bobcat"))
root.putChild('upload', UploadVBO())
root.putChild('load', Load())
root.putChild('finalize', CreatePointCloudFile())

factory = Site(root)
reactor.listenTCP(8080, factory)
reactor.run()
